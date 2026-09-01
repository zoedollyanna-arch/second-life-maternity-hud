// Partner relationship, permissions, and the one interaction-request framework
// every consent-gated partner action goes through.
//
// Mom owns the pregnancy. Everything here is a guard in front of her data or a
// request for her to answer — nothing in this file advances a pregnancy.

import { db } from "./db";
import { publishEvent, addNotification, queueCommand } from "./bus";
import {
  DEFAULT_PARTNER_PERMISSIONS,
  PARTNER_ACTIONS,
  BAG_ITEM_KEYS,
  HOSPITAL_BAG_ITEMS,
  type PartnerPermission,
} from "../partner";
import type { HudUser } from "./game";

export interface PartnerLink {
  id: string;
  pregnancy_id: string;
  pregnant_user_id: string;
  partner_user_id: string;
  status: "pending" | "active" | "declined" | "removed";
  permissions: Record<string, unknown>;
  requested_at: string;
  accepted_at: string | null;
  disconnected_at: string | null;
}

/** Physical contact asks first; fetching and carrying does not. Mom can change both. */
const DEFAULT_AUTO_ACCEPT: Record<string, boolean> = {
  hug: false,
  kiss: false,
  feel_baby_kick: false,
  partner_backrub: false,
  partner_ice_chips: true,
  partner_medicine: true,
  partner_water: true,
  partner_help_rest: true,
};

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * Effective permissions = defaults, then the legacy
 * user_settings.partnerPermissions block (so nobody's existing choices are
 * silently reset), then whatever Mom has set on the link itself.
 */
export function resolvePermissions(
  linkPermissions: Record<string, unknown> | null | undefined,
  legacy: Record<string, unknown> | null | undefined,
): Record<PartnerPermission, boolean> & { autoAccept: Record<string, boolean> } {
  const out = { ...DEFAULT_PARTNER_PERMISSIONS } as Record<PartnerPermission, boolean>;

  if (legacy && typeof legacy === "object") {
    const map: Record<string, PartnerPermission[]> = {
      babyUpdates: ["viewKicks", "viewStage"],
      momWellness: ["viewWellness"],
      appointments: ["viewAppointments"],
      journalMemories: ["viewJournal"],
    };
    for (const [legacyKey, keys] of Object.entries(map)) {
      const value = legacy[legacyKey];
      if (typeof value === "boolean") for (const key of keys) out[key] = value;
    }
  }

  const autoAccept = { ...DEFAULT_AUTO_ACCEPT };
  if (linkPermissions && typeof linkPermissions === "object") {
    for (const key of Object.keys(out) as PartnerPermission[]) {
      const value = linkPermissions[key];
      if (typeof value === "boolean") out[key] = value;
    }
    const raw = linkPermissions.autoAccept;
    if (raw && typeof raw === "object") {
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value === "boolean" && key in PARTNER_ACTIONS) autoAccept[key] = value;
      }
    }
  }
  return { ...out, autoAccept };
}

// ---------------------------------------------------------------------------
// Link lookup
// ---------------------------------------------------------------------------

export async function activeLinkForPregnancy(pregnancyId: string): Promise<PartnerLink | null> {
  const { rows } = await db().query(
    `select * from pregnancy_partner_links
      where pregnancy_id = $1 and status = 'active' limit 1`,
    [pregnancyId],
  );
  return (rows[0] as PartnerLink) ?? null;
}

export async function activeLinkForPartner(partnerUserId: string): Promise<PartnerLink | null> {
  const { rows } = await db().query(
    `select l.* from pregnancy_partner_links l
       join pregnancies p on p.id = l.pregnancy_id
      where l.partner_user_id = $1 and l.status = 'active'
      order by case when p.status = 'active' then 0 else 1 end, l.accepted_at desc nulls last
      limit 1`,
    [partnerUserId],
  );
  return (rows[0] as PartnerLink) ?? null;
}

export async function pendingLinksForMom(pregnancyId: string) {
  const { rows } = await db().query(
    `select l.id, l.partner_user_id, l.requested_at, u.avatar_name, u.display_name
       from pregnancy_partner_links l
       join hud_users u on u.id = l.partner_user_id
      where l.pregnancy_id = $1 and l.status = 'pending'
      order by l.requested_at desc`,
    [pregnancyId],
  );
  return rows;
}

export interface PartnerContext {
  link: PartnerLink;
  preg: Record<string, unknown> & { id: string; user_id: string };
  momId: string;
  momName: string;
  permissions: ReturnType<typeof resolvePermissions>;
}

/**
 * The single authorisation gate. Resolves the caller's *own* active link and
 * the pregnancy it points at — a pregnancy id from the browser is never
 * trusted, so knowing one buys nothing.
 */
export async function partnerContext(user: HudUser): Promise<PartnerContext | null> {
  const link = await activeLinkForPartner(user.id);
  if (!link) return null;
  const { rows } = await db().query(
    `select p.*, u.avatar_name as mom_avatar_name, u.display_name as mom_display_name,
            s.settings as mom_settings
       from pregnancies p
       join hud_users u on u.id = p.user_id
       left join user_settings s on s.user_id = p.user_id
      where p.id = $1`,
    [link.pregnancy_id],
  );
  const preg = rows[0];
  if (!preg) return null;
  const legacy = (preg.mom_settings as Record<string, unknown> | null)?.partnerPermissions as
    Record<string, unknown> | undefined;
  return {
    link,
    preg,
    momId: preg.user_id,
    momName: (preg.mom_display_name as string) ?? (preg.mom_avatar_name as string),
    permissions: resolvePermissions(link.permissions, legacy),
  };
}

export async function permissionsForPregnancy(pregnancyId: string, momId: string) {
  const [link, settings] = await Promise.all([
    activeLinkForPregnancy(pregnancyId),
    db().query(`select settings from user_settings where user_id = $1`, [momId]),
  ]);
  const legacy = settings.rows[0]?.settings?.partnerPermissions as
    Record<string, unknown> | undefined;
  return resolvePermissions(link?.permissions, legacy);
}

// ---------------------------------------------------------------------------
// Linking lifecycle
// ---------------------------------------------------------------------------

/**
 * A partner redeems Mom's pairing code. This creates a *pending* link — Mom
 * still has to say yes — unless she has already linked this same person before,
 * in which case reconnecting is immediate.
 */
export async function requestLink(opts: {
  pregnancyId: string;
  momId: string;
  partnerUserId: string;
  partnerName: string;
  momName: string;
}): Promise<{ status: "pending" | "active"; linkId: string }> {
  const existingActive = await activeLinkForPregnancy(opts.pregnancyId);
  if (existingActive) {
    if (existingActive.partner_user_id === opts.partnerUserId) {
      return { status: "active", linkId: existingActive.id };
    }
    throw new Error("She already has a partner linked. She can remove them from her HUD first.");
  }

  // Someone she previously removed can reconnect without a fresh approval.
  const { rows: prior } = await db().query(
    `select id from pregnancy_partner_links
      where pregnancy_id = $1 and partner_user_id = $2 and status = 'removed'
      order by disconnected_at desc limit 1`,
    [opts.pregnancyId, opts.partnerUserId],
  );

  if (prior[0]) {
    const { rows } = await db().query(
      `update pregnancy_partner_links
          set status = 'active', accepted_at = now(), disconnected_at = null, updated_at = now()
        where id = $1 returning id`,
      [prior[0].id],
    );
    await activateLink(opts.pregnancyId, opts.partnerUserId, opts.partnerName, opts.momId);
    return { status: "active", linkId: rows[0].id as string };
  }

  const { rows } = await db().query(
    `insert into pregnancy_partner_links
       (pregnancy_id, pregnant_user_id, partner_user_id, status)
     values ($1, $2, $3, 'pending')
     on conflict (pregnancy_id, partner_user_id) where status = 'pending'
     do update set requested_at = now(), updated_at = now()
     returning id`,
    [opts.pregnancyId, opts.momId, opts.partnerUserId],
  );

  await publishEvent(opts.pregnancyId, "PARTNER_REQUEST", "Partner wants to connect", {
    severity: "request",
    body: `${opts.partnerName} entered your pairing code. Accept to link your HUDs.`,
    notify: [opts.momId],
  });
  await queueCommand(opts.momId, "hud", "say", {
    text: `${opts.partnerName} wants to link their Partner HUD. Open Partner on your HUD to accept.`,
  });
  return { status: "pending", linkId: rows[0].id as string };
}

/** Mom accepts. Keeps pregnancies.partner_user_id in sync for existing queries. */
export async function activateLink(
  pregnancyId: string,
  partnerUserId: string,
  partnerName: string,
  momId: string,
) {
  await db().query(
    `update pregnancies set partner_user_id = $2, partner_name = $3, updated_at = now()
      where id = $1`,
    [pregnancyId, partnerUserId, partnerName],
  );
  await db().query(
    `update pregnancy_partner_links
        set status = 'active', accepted_at = coalesce(accepted_at, now()),
            disconnected_at = null, updated_at = now()
      where pregnancy_id = $1 and partner_user_id = $2`,
    [pregnancyId, partnerUserId],
  );
  await ensureMilestone(pregnancyId, "pregnancy_linked", "Pregnancy linked", {
    body: `${partnerName} joined the journey.`,
    notify: [momId, partnerUserId],
  });
  await queueCommand(partnerUserId, "partner", "say", { text: "You're linked ♥" });
}

export async function respondToLink(
  momUser: HudUser,
  pregnancyId: string,
  linkId: string,
  accept: boolean,
): Promise<{ ok: boolean; message: string }> {
  const { rows } = await db().query(
    `select l.*, u.avatar_name, u.display_name
       from pregnancy_partner_links l join hud_users u on u.id = l.partner_user_id
      where l.id = $1 and l.pregnancy_id = $2 and l.pregnant_user_id = $3 and l.status = 'pending'`,
    [linkId, pregnancyId, momUser.id],
  );
  const link = rows[0];
  if (!link) return { ok: false, message: "That partner request is no longer waiting." };
  const partnerName = (link.display_name as string) ?? (link.avatar_name as string);

  if (!accept) {
    await db().query(
      `update pregnancy_partner_links
          set status = 'declined', disconnected_at = now(), updated_at = now() where id = $1`,
      [linkId],
    );
    await addNotification(link.partner_user_id, "Not linked", "The pairing wasn't accepted.", {
      severity: "info",
    });
    await queueCommand(link.partner_user_id, "partner", "say", {
      text: "The pairing wasn't accepted.",
    });
    return { ok: true, message: "Partner request declined." };
  }

  await activateLink(pregnancyId, link.partner_user_id, partnerName, momUser.id);
  return { ok: true, message: `${partnerName} is now linked ♥` };
}

export async function removePartner(
  pregnancyId: string,
  momId: string,
): Promise<{ ok: boolean; message: string }> {
  const link = await activeLinkForPregnancy(pregnancyId);
  if (!link) return { ok: false, message: "No partner is linked." };
  await db().query(
    `update pregnancy_partner_links
        set status = 'removed', disconnected_at = now(), updated_at = now() where id = $1`,
    [link.id],
  );
  await db().query(
    `update pregnancies set partner_user_id = null, partner_name = null, updated_at = now()
      where id = $1`,
    [pregnancyId],
  );
  // Any request they had in flight dies with the link.
  await db().query(
    `update pregnancy_interaction_requests set status = 'cancelled', responded_at = now()
      where pregnancy_id = $1 and status = 'pending'`,
    [pregnancyId],
  );
  await addNotification(link.partner_user_id, "Disconnected", "The pregnancy link was removed.", {
    severity: "info",
  });
  await queueCommand(link.partner_user_id, "partner", "say", {
    text: "The pregnancy link was removed.",
  });
  void momId;
  return { ok: true, message: "Partner disconnected." };
}

export async function updateLinkPermissions(
  pregnancyId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const clean: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_PARTNER_PERMISSIONS)) {
    if (typeof patch[key] === "boolean") clean[key] = patch[key];
  }
  if (patch.autoAccept && typeof patch.autoAccept === "object") {
    const auto: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(patch.autoAccept as Record<string, unknown>)) {
      if (typeof value === "boolean" && key in PARTNER_ACTIONS) auto[key] = value;
    }
    if (Object.keys(auto).length) clean.autoAccept = auto;
  }
  if (!Object.keys(clean).length) return;
  await db().query(
    `update pregnancy_partner_links
        set permissions = permissions || $2::jsonb, updated_at = now()
      where pregnancy_id = $1 and status = 'active'`,
    [pregnancyId, JSON.stringify(clean)],
  );
}

// ---------------------------------------------------------------------------
// Interaction requests
// ---------------------------------------------------------------------------

export async function expireStaleRequests(pregnancyId: string) {
  await db().query(
    `update pregnancy_interaction_requests
        set status = 'expired', responded_at = now()
      where pregnancy_id = $1 and status = 'pending' and expires_at < now()`,
    [pregnancyId],
  );
}

export async function createInteractionRequest(opts: {
  pregnancyId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  actionType: string;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; message: string; requestId?: string }> {
  const def = PARTNER_ACTIONS[opts.actionType];
  if (!def) return { ok: false, message: "That isn't something you can ask for." };
  await expireStaleRequests(opts.pregnancyId);

  const { rows } = await db().query(
    `insert into pregnancy_interaction_requests
       (pregnancy_id, sender_id, recipient_id, action_type, payload)
     values ($1, $2, $3, $4, $5)
     on conflict (pregnancy_id, sender_id, action_type) where status = 'pending'
     do nothing
     returning id`,
    [
      opts.pregnancyId,
      opts.senderId,
      opts.recipientId,
      opts.actionType,
      JSON.stringify(opts.payload ?? {}),
    ],
  );
  // Double-tap: the earlier identical request is still waiting. Say so rather
  // than stacking a second prompt on her screen.
  if (!rows[0]) return { ok: true, message: "Already asked — waiting on her." };

  const line = `${opts.senderName} ${def.request ?? "would like a moment"}.`;
  await publishEvent(opts.pregnancyId, "PARTNER_REQUEST", def.label, {
    severity: "request",
    body: line,
    actorId: opts.senderId,
    metadata: { requestId: rows[0].id, actionType: opts.actionType },
    notify: [opts.recipientId],
    notifyTitle: def.label,
    notifyBody: line,
  });
  await queueCommand(opts.recipientId, "hud", "say", { text: line });
  return {
    ok: true,
    message: `Asked. Waiting for her to answer.`,
    requestId: rows[0].id as string,
  };
}

export async function pendingRequestsFor(userId: string, pregnancyId: string) {
  await expireStaleRequests(pregnancyId);
  const { rows } = await db().query(
    `select r.id, r.action_type, r.payload, r.created_at, r.expires_at,
            u.avatar_name, u.display_name
       from pregnancy_interaction_requests r
       join hud_users u on u.id = r.sender_id
      where r.recipient_id = $1 and r.pregnancy_id = $2 and r.status = 'pending'
      order by r.created_at asc`,
    [userId, pregnancyId],
  );
  return rows.map((r) => ({
    id: r.id as string,
    actionType: r.action_type as string,
    label: PARTNER_ACTIONS[r.action_type as string]?.label ?? (r.action_type as string),
    from: (r.display_name as string) ?? (r.avatar_name as string),
    line: `${(r.display_name as string) ?? (r.avatar_name as string)} ${
      PARTNER_ACTIONS[r.action_type as string]?.request ?? "would like a moment"
    }`,
    createdAt: r.created_at as string,
    expiresAt: r.expires_at as string,
  }));
}

/**
 * Claim a pending request for the recipient. The guarded UPDATE means a
 * double-tapped Accept resolves exactly once.
 */
export async function claimRequest(
  requestId: string,
  recipientId: string,
  status: "accepted" | "declined" | "cancelled",
) {
  const { rows } = await db().query(
    `update pregnancy_interaction_requests
        set status = $3, responded_at = now()
      where id = $1 and recipient_id = $2 and status = 'pending' and expires_at > now()
      returning *`,
    [requestId, recipientId, status],
  );
  return rows[0] ?? null;
}

export async function cancelRequestBySender(requestId: string, senderId: string) {
  const { rows } = await db().query(
    `update pregnancy_interaction_requests
        set status = 'cancelled', responded_at = now()
      where id = $1 and sender_id = $2 and status = 'pending' returning *`,
    [requestId, senderId],
  );
  return rows[0] ?? null;
}

/** What the partner is still waiting to hear back about. */
export async function outgoingRequests(senderId: string, pregnancyId: string) {
  await expireStaleRequests(pregnancyId);
  const { rows } = await db().query(
    `select id, action_type, created_at, expires_at
       from pregnancy_interaction_requests
      where sender_id = $1 and pregnancy_id = $2 and status = 'pending'`,
    [senderId, pregnancyId],
  );
  return rows.map((r) => ({
    id: r.id as string,
    actionType: r.action_type as string,
    label: PARTNER_ACTIONS[r.action_type as string]?.label ?? (r.action_type as string),
    expiresAt: r.expires_at as string,
  }));
}

// ---------------------------------------------------------------------------
// Shared hospital bag
// ---------------------------------------------------------------------------

export async function hospitalBag(pregnancyId: string) {
  const { rows } = await db().query(
    `select item_key, checked, checked_name, checked_at
       from hospital_bag_items where pregnancy_id = $1`,
    [pregnancyId],
  );
  const byKey = new Map(rows.map((r) => [r.item_key as string, r]));
  const items = HOSPITAL_BAG_ITEMS.map((def) => {
    const row = byKey.get(def.key);
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      checked: Boolean(row?.checked),
      checkedBy: (row?.checked_name as string | null) ?? null,
      checkedAt: (row?.checked_at as string | null) ?? null,
    };
  });
  const packed = items.filter((i) => i.checked).length;
  return {
    items,
    packed,
    total: items.length,
    percent: Math.round((packed / items.length) * 100),
    ready: packed === items.length,
  };
}

export async function setBagItem(opts: {
  pregnancyId: string;
  itemKey: string;
  checked: boolean;
  userId: string;
  userName: string;
}): Promise<{ ok: boolean; message: string; changed: boolean }> {
  if (!BAG_ITEM_KEYS.has(opts.itemKey)) {
    return { ok: false, message: "That isn't a hospital bag item.", changed: false };
  }
  // Idempotent: re-checking an already-checked item is a no-op, so a double tap
  // or a stale HUD cannot produce a second "packed by" event.
  const { rows } = await db().query(
    `insert into hospital_bag_items
       (pregnancy_id, item_key, checked, checked_by, checked_name, checked_at, updated_at)
     values ($1, $2, $3, $4, $5, case when $3 then now() else null end, now())
     on conflict (pregnancy_id, item_key) do update
       set checked = excluded.checked,
           checked_by = case when excluded.checked then excluded.checked_by else null end,
           checked_name = case when excluded.checked then excluded.checked_name else null end,
           checked_at = case when excluded.checked then now() else null end,
           updated_at = now()
       where hospital_bag_items.checked is distinct from excluded.checked
     returning item_key`,
    [opts.pregnancyId, opts.itemKey, opts.checked, opts.userId, opts.userName],
  );
  if (!rows[0]) return { ok: true, message: "Already up to date.", changed: false };

  const bag = await hospitalBag(opts.pregnancyId);
  const label = HOSPITAL_BAG_ITEMS.find((i) => i.key === opts.itemKey)?.label ?? opts.itemKey;
  await publishEvent(
    opts.pregnancyId,
    "HOSPITAL_BAG_UPDATED",
    opts.checked ? `${label} packed` : `${label} unpacked`,
    {
      severity: "info",
      body: `${opts.userName} · ${bag.packed}/${bag.total} packed`,
      actorId: opts.userId,
      metadata: { itemKey: opts.itemKey, checked: opts.checked, percent: bag.percent },
    },
  );
  if (bag.ready) {
    await ensureMilestone(opts.pregnancyId, "hospital_bag_ready", "Hospital bag ready", {
      body: "Everything is packed and by the door.",
    });
  }
  return {
    ok: true,
    message: opts.checked ? `${label} packed — ${bag.packed}/${bag.total}` : `${label} unpacked`,
    changed: true,
  };
}

// ---------------------------------------------------------------------------
// Shared milestones
// ---------------------------------------------------------------------------

export async function ensureMilestone(
  pregnancyId: string,
  key: string,
  title: string,
  options: { body?: string; week?: number; notify?: string[] } = {},
): Promise<boolean> {
  const { rows } = await db().query(
    `insert into pregnancy_milestones (pregnancy_id, key, title, body, week)
     values ($1, $2, $3, $4, $5)
     on conflict (pregnancy_id, key) do nothing
     returning id`,
    [pregnancyId, key, title, options.body ?? null, options.week ?? null],
  );
  if (!rows[0]) return false;

  const recipients = options.notify ?? (await bothPartners(pregnancyId));
  await publishEvent(pregnancyId, "MILESTONE_UNLOCKED", title, {
    severity: "milestone",
    body: options.body ?? null,
    metadata: { milestoneKey: key },
    notify: recipients,
    notifyTitle: `New milestone ♥ ${title}`,
  });
  return true;
}

export async function milestonesFor(pregnancyId: string) {
  const { rows } = await db().query(
    `select id, key, title, body, week, celebrated_by, created_at
       from pregnancy_milestones where pregnancy_id = $1 order by created_at desc limit 30`,
    [pregnancyId],
  );
  return rows.map((r) => ({
    id: r.id as string,
    key: r.key as string,
    title: r.title as string,
    body: r.body as string | null,
    week: r.week as number | null,
    celebratedBy: Array.isArray(r.celebrated_by) ? (r.celebrated_by as string[]) : [],
    createdAt: r.created_at as string,
  }));
}

/** Celebrating is idempotent per person — no repeat rewards for tapping twice. */
export async function celebrateMilestone(
  pregnancyId: string,
  milestoneId: string,
  userId: string,
  userName: string,
): Promise<{ ok: boolean; message: string; first: boolean }> {
  const { rows } = await db().query(
    `update pregnancy_milestones
        set celebrated_by = celebrated_by || to_jsonb($3::text)
      where id = $1 and pregnancy_id = $2
        and not (celebrated_by @> to_jsonb($3::text))
      returning title`,
    [milestoneId, pregnancyId, userId],
  );
  if (!rows[0]) return { ok: true, message: "Already celebrated ♥", first: false };
  const title = rows[0].title as string;
  await publishEvent(pregnancyId, "MILESTONE_CELEBRATED", `${userName} celebrated: ${title}`, {
    severity: "milestone",
    actorId: userId,
    metadata: { milestoneId },
  });
  return { ok: true, message: `You celebrated "${title}" ♥`, first: true };
}

export async function bothPartners(pregnancyId: string): Promise<string[]> {
  const { rows } = await db().query(
    `select user_id, partner_user_id from pregnancies where id = $1`,
    [pregnancyId],
  );
  if (!rows[0]) return [];
  return [rows[0].user_id, rows[0].partner_user_id].filter(Boolean) as string[];
}
