// Command queue (server → in-world objects) and the normalized pregnancy event
// bus (server → both HUDs).
//
// This lives outside game.ts so the labor engine can publish events without
// importing the action engine that imports the labor engine. game.ts re-exports
// queueCommand/addNotification, so every existing import keeps working.

import { db, apiSecret } from "./db";

export type DeviceKind = "hud" | "belly" | "partner";

export type EventSeverity =
  "info" | "milestone" | "request" | "important" | "labor" | "urgent" | "birth";

// ---------------------------------------------------------------------------
// Second Life command queue
// ---------------------------------------------------------------------------

export async function queueCommand(
  userId: string,
  deviceKind: DeviceKind,
  command: string,
  params: Record<string, unknown> = {},
) {
  await db().query(
    `insert into sl_commands (user_id, device_kind, command, params)
     values ($1, $2, $3, $4)`,
    [userId, deviceKind, command, JSON.stringify(params)],
  );
  // best-effort push to the in-world object; polling is the fallback
  void pushPending(userId, deviceKind).catch(() => {});
}

type PendingCommand = {
  id: string;
  command: string;
  params: Record<string, unknown>;
};

async function claimPendingCommands(userId: string, kind: string): Promise<PendingCommand[]> {
  // housekeeping: drop delivered commands and stale pending ones (a device
  // that was offline for a day shouldn't replay a burst of old effects)
  await db().query(
    `delete from sl_commands
     where user_id = $1
       and ((status = 'sent' and sent_at < now() - interval '2 days')
         or (status = 'pending' and created_at < now() - interval '1 day'))`,
    [userId],
  );
  const { rows } = await db().query(
    `update sl_commands set status = 'sent', sent_at = now()
     where id in (
       select id from sl_commands
       where user_id = $1 and device_kind = $2 and status = 'pending'
       order by created_at limit 10
       for update skip locked
     ) and status = 'pending'
     returning id, command, params`,
    [userId, kind],
  );
  return rows as PendingCommand[];
}

export async function takePendingCommands(userId: string, kind: string) {
  const commands = await claimPendingCommands(userId, kind);
  return commands.map(({ command, params }) => ({ command, params }));
}

async function pushPending(userId: string, kind: DeviceKind) {
  const { rows } = await db().query(
    `select callback_url from sl_devices where user_id = $1 and kind = $2`,
    [userId, kind],
  );
  const url = rows[0]?.callback_url as string | undefined;
  if (!url) return;
  const claimed = await claimPendingCommands(userId, kind);
  const commands = claimed.map(({ command, params }) => ({ command, params }));
  if (!commands.length) return;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: apiSecret(), commands }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Second Life callback returned HTTP ${response.status}`);
  } catch {
    // object offline/URL dead — requeue so the next poll picks them up
    await db().query(
      `update sl_commands set status = 'pending', sent_at = null
       where id = any($1::uuid[]) and status = 'sent'`,
      [claimed.map((item) => item.id)],
    );
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface NotifyOptions {
  severity?: EventSeverity;
  pregnancyId?: string | null;
  senderId?: string | null;
  eventType?: string | null;
  eventId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function addNotification(
  userId: string,
  title: string,
  body?: string,
  options: NotifyOptions = {},
) {
  await db().query(
    `insert into notifications
       (user_id, title, body, severity, pregnancy_id, sender_id, event_type, event_id, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      userId,
      title,
      body ?? null,
      options.severity ?? "info",
      options.pregnancyId ?? null,
      options.senderId ?? null,
      options.eventType ?? null,
      options.eventId ?? null,
      JSON.stringify(options.metadata ?? {}),
    ],
  );
}

// ---------------------------------------------------------------------------
// Pregnancy event bus
// ---------------------------------------------------------------------------

export interface PublishOptions {
  severity?: EventSeverity;
  body?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  /**
   * Stable key for events that must fire at most once per pregnancy (labor
   * milestones, birth). A second concurrent HUD poll trying to emit the same
   * key is silently dropped, which is what makes the engine safe to run from
   * every request.
   */
  dedupeKey?: string | null;
  /** Also drop a notification in these users' inboxes. */
  notify?: string[];
  /** Title used for the notification when it should differ from the event. */
  notifyTitle?: string;
  notifyBody?: string;
}

export interface PublishedEvent {
  id: string;
  type: string;
  severity: EventSeverity;
  title: string;
  created_at: string;
}

/**
 * Records one pregnancy event and fans it out to the given inboxes.
 * Returns null when a dedupeKey collision means the event already happened —
 * callers use that to skip the side effects too.
 */
export async function publishEvent(
  pregnancyId: string,
  type: string,
  title: string,
  options: PublishOptions = {},
): Promise<PublishedEvent | null> {
  const { rows } = await db().query(
    `insert into pregnancy_events
       (pregnancy_id, type, severity, title, body, actor_id, metadata, dedupe_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (pregnancy_id, dedupe_key) where dedupe_key is not null do nothing
     returning id, type, severity, title, created_at`,
    [
      pregnancyId,
      type,
      options.severity ?? "info",
      title,
      options.body ?? null,
      options.actorId ?? null,
      JSON.stringify(options.metadata ?? {}),
      options.dedupeKey ?? null,
    ],
  );
  const event = rows[0] as PublishedEvent | undefined;
  if (!event) return null;

  for (const userId of options.notify ?? []) {
    if (!userId) continue;
    await addNotification(
      userId,
      options.notifyTitle ?? title,
      options.notifyBody ?? options.body ?? undefined,
      {
        severity: options.severity ?? "info",
        pregnancyId,
        senderId: options.actorId ?? null,
        eventType: type,
        eventId: event.id,
        metadata: options.metadata,
      },
    );
  }
  return event;
}

/** The shared feed both HUDs read; also powers "while you were away". */
export async function recentEvents(pregnancyId: string, limit = 25) {
  const { rows } = await db().query(
    `select id, type, severity, title, body, metadata, created_at
       from pregnancy_events where pregnancy_id = $1
       order by created_at desc limit $2`,
    [pregnancyId, Math.min(100, Math.max(1, limit))],
  );
  return rows;
}
