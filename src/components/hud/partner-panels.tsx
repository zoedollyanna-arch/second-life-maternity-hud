// Panels shared by the Pregnancy HUD and the Partner HUD.
//
// Both HUDs are views onto one pregnancy, so the pieces that show shared state
// — the bag, the milestones, the request inbox, the labor board — are literally
// the same components. That is what keeps them from drifting apart.

import { Check, Briefcase, Trophy, Heart, X, Hourglass, Activity } from "lucide-react";
import { Panel, PanelHeader, PrimaryButton, Row, CloudBar } from "@/components/hud/chrome";
import type { HudState } from "@/lib/hud-api";
import { LABOR_PHASE_LABEL, PERMISSION_GROUPS, PARTNER_ACTIONS } from "@/lib/partner";

type Act = (name: string, params?: Record<string, unknown>) => void;

// ---------------------------------------------------------------------------
// Incoming interaction requests (Mom's side of the consent framework)
// ---------------------------------------------------------------------------

export function RequestInbox({
  data,
  act,
  pending,
}: {
  data: HudState;
  act: Act;
  pending: boolean;
}) {
  const requests = data.requests?.incoming ?? [];
  if (requests.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        eyebrow="Waiting on you"
        title={requests.length === 1 ? "A moment together" : `${requests.length} moments waiting`}
      />
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="rounded-2xl bg-white/80 px-3 py-2">
            <div className="hud-copy font-semibold">{r.line}</div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => act("request_respond", { requestId: r.id, accept: true })}
                className="hud-btn-primary mt-0 min-h-12 flex-1 disabled:opacity-50"
              >
                <Check className="mr-1 inline h-4 w-4" /> Yes ♥
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => act("request_respond", { requestId: r.id, accept: false })}
                className="min-h-12 flex-1 rounded-full bg-white/70 px-4 hud-copy font-semibold disabled:opacity-50"
              >
                <X className="mr-1 inline h-4 w-4" /> Not now
              </button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Pending partner link approvals
// ---------------------------------------------------------------------------

export function LinkApprovals({
  data,
  act,
  pending,
}: {
  data: HudState;
  act: Act;
  pending: boolean;
}) {
  const links = data.partner?.pendingLinks ?? [];
  if (links.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        eyebrow="Partner request"
        title="Someone wants to connect"
        subtitle="They entered your pairing code. Nothing is shared until you accept."
      />
      <div className="space-y-2">
        {links.map((l) => (
          <div key={l.id} className="rounded-2xl bg-white/80 px-3 py-2">
            <div className="hud-copy font-semibold">{l.display_name ?? l.avatar_name}</div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => act("partner_link_respond", { linkId: l.id, accept: true })}
                className="hud-btn-primary mt-0 min-h-12 flex-1 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => act("partner_link_respond", { linkId: l.id, accept: false })}
                className="min-h-12 flex-1 rounded-full bg-white/70 px-4 hud-copy font-semibold disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Mom's privacy controls
// ---------------------------------------------------------------------------

export function PartnerPrivacy({
  data,
  act,
  pending,
}: {
  data: HudState;
  act: Act;
  pending: boolean;
}) {
  const perms = data.partner?.permissions;
  if (!data.partner?.linked) return null;

  const value = (key: string) => perms?.[key] !== false;
  const autoValue = (key: string) => perms?.autoAccept?.[key] === true;

  const toggle = (key: string) =>
    act("partner_permissions", { permissions: { [key]: !value(key) } });
  const toggleAuto = (key: string) =>
    act("partner_permissions", { permissions: { autoAccept: { [key]: !autoValue(key) } } });

  const consentActions = Object.values(PARTNER_ACTIONS).filter((d) => d.consent);

  return (
    <>
      {PERMISSION_GROUPS.map((group) => (
        <Panel key={group.title}>
          <PanelHeader eyebrow="Privacy" title={group.title} />
          <div className="space-y-2">
            {group.items.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={pending}
                onClick={() => toggle(item.key)}
                className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl bg-white/80 px-3 py-2 text-left disabled:opacity-60"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    value(item.key) ? "bg-[#A77ACB] text-white" : "bg-[#E9E3EF]"
                  }`}
                >
                  {value(item.key) && <Check className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="hud-copy block truncate font-semibold">{item.label}</span>
                  <span className="hud-label block truncate">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </Panel>
      ))}

      <Panel>
        <PanelHeader
          eyebrow="Consent"
          title="Ask me first"
          subtitle="Ticked actions happen straight away. Unticked ones wait for your yes."
        />
        <div className="space-y-2">
          {consentActions.map((def) => (
            <button
              key={def.action}
              type="button"
              disabled={pending}
              onClick={() => toggleAuto(def.action)}
              className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl bg-white/80 px-3 py-2 text-left disabled:opacity-60"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  autoValue(def.action) ? "bg-[#A77ACB] text-white" : "bg-[#E9E3EF]"
                }`}
              >
                {autoValue(def.action) && <Check className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="hud-copy block truncate font-semibold">{def.label}</span>
                <span className="hud-label block truncate">
                  {autoValue(def.action) ? "Happens right away" : "Asks you first"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Connection" title={data.partner.name ?? "Linked"} />
        <button
          type="button"
          disabled={pending}
          onClick={() => act("partner_remove")}
          className="min-h-12 w-full rounded-full bg-white/70 px-4 hud-copy font-semibold disabled:opacity-50"
        >
          Disconnect partner
        </button>
        <p className="mt-2 text-center hud-muted italic">
          They can reconnect later with your code without asking again.
        </p>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared hospital bag
// ---------------------------------------------------------------------------

export function HospitalBagPanels({
  data,
  act,
  pending,
}: {
  data: HudState;
  act: Act;
  pending: boolean;
}) {
  const bag = data.hospitalBag;
  const perms = data.partner?.permissions;
  const readOnly = data.user.role === "partner" && perms?.allowHospitalBag === false;

  if (!bag) {
    return (
      <Panel>
        <PanelHeader eyebrow="Hospital bag" title="Unavailable" />
        <p className="text-center hud-copy">The shared checklist could not be loaded right now.</p>
      </Panel>
    );
  }

  const groups = ["Mom", "Personal", "Baby"] as const;
  return (
    <div className="space-y-2">
      <Panel>
        <PanelHeader
          eyebrow="Hospital bag"
          title={bag.ready ? "Hospital Bag Ready 💕" : `${bag.packed} / ${bag.total} packed`}
          subtitle={`${bag.percent}% ready · shared with ${
            data.user.role === "partner" ? "her" : "your partner"
          }`}
        />
        <CloudBar value={bag.percent} tone={bag.ready ? "blush" : "lavender"} />
        {readOnly && (
          <p className="mt-2 text-center hud-muted italic">
            She has the checklist set to view-only for you.
          </p>
        )}
      </Panel>

      {groups.map((group) => (
        <Panel key={group}>
          <PanelHeader eyebrow={group} title={`${group} bag`} />
          <div className="space-y-2">
            {bag.items
              .filter((i) => i.group === group)
              .map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={pending || readOnly}
                  onClick={() => act("bag_item", { itemKey: item.key, checked: !item.checked })}
                  className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl bg-white/80 px-3 py-2 text-left disabled:opacity-60"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      item.checked ? "bg-[#A77ACB] text-white" : "bg-[#E9E3EF]"
                    }`}
                  >
                    {item.checked && <Check className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="hud-copy block truncate font-semibold">{item.label}</span>
                    {item.checked && item.checkedBy && (
                      <span className="hud-label block truncate">Packed by {item.checkedBy}</span>
                    )}
                  </span>
                </button>
              ))}
          </div>
        </Panel>
      ))}

      <Panel>
        <PanelHeader eyebrow="In-world" title="The worn bag" />
        <p className="text-center hud-copy">
          The checklist is shared between both HUDs. The physical bag object still works — open it
          to play the packing scene.
        </p>
        <PrimaryButton onClick={() => act("bag_rez")} disabled={pending}>
          <Briefcase className="mr-2 inline h-4 w-4" /> Open the worn bag
        </PrimaryButton>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared milestone feed
// ---------------------------------------------------------------------------

export function MilestonesPanel({
  data,
  act,
  pending,
}: {
  data: HudState;
  act: Act;
  pending: boolean;
}) {
  const milestones = data.milestones ?? [];
  return (
    <Panel className="is-scroll">
      <PanelHeader eyebrow="Together" title="Our pregnancy milestones" />
      {milestones.length === 0 ? (
        <p className="text-center hud-muted italic">No milestones yet — they're coming.</p>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => (
            <div key={m.id} className="rounded-2xl bg-white/70 px-3 py-2">
              <div className="hud-copy font-semibold">{m.title}</div>
              {m.body && <p className="hud-muted">{m.body}</p>}
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="hud-label">
                  {m.week ? `Week ${m.week} · ` : ""}
                  {new Date(m.createdAt).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act("milestone_celebrate", { milestoneId: m.id })}
                  className="min-h-10 rounded-full bg-[#F6C6D6]/60 px-4 hud-copy font-semibold disabled:opacity-50"
                >
                  <Trophy className="mr-1 inline h-3.5 w-3.5" />
                  {m.celebratedBy.length > 0 ? "Celebrated ♥" : "Celebrate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Mom's labor board
// ---------------------------------------------------------------------------

export function MomLaborPanels({
  data,
  act,
  pending,
}: {
  data: HudState;
  act: Act;
  pending: boolean;
}) {
  const preg = data.pregnancy;
  const labor = preg.labor;

  if (preg.delivered) {
    return (
      <Panel>
        <PanelHeader
          eyebrow="You did it"
          title={preg.babyName ? `${preg.babyName} is here ♥` : "Your baby is here ♥"}
        />
        <p className="text-center hud-copy">
          Labor is over. Everything from the journey is kept in your journal and milestones.
        </p>
      </Panel>
    );
  }

  if (!labor?.inLabor) {
    return (
      <Panel>
        <PanelHeader
          eyebrow="Labor"
          title={labor?.phase === "prelabor" ? "Something is starting" : "Not yet"}
          subtitle={
            labor?.phase === "prelabor"
              ? "Twinges and tightening. It won't be long."
              : "Your body decides when. There is nothing to press."
          }
        />
        <p className="text-center hud-copy">
          Labor starts on its own, some time near your due date. You and your partner find out at
          the same moment.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-2">
      <Panel>
        <PanelHeader
          eyebrow="Labor"
          title={LABOR_PHASE_LABEL[labor.phase]}
          subtitle={
            labor.minutesToBirth != null && labor.minutesToBirth > 0
              ? `Roughly ${labor.minutesToBirth} min to go`
              : "Any moment now"
          }
        />
        <CloudBar value={labor.intensity} tone="blush" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Row label="Intensity" value={`${labor.intensity}%`} />
          <Row label="In labor" value={`${labor.contractionMinutes} min`} />
          <Row label="Waters" value={labor.waterBroken ? "Broken" : "Intact"} />
          <Row
            label="Hospital"
            value={labor.atHospital ? "Arrived" : labor.hospitalAdvised ? "Time to go" : "Not yet"}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="You" title="What you can do" />
        <div className="hud-care-grid">
          <button
            type="button"
            disabled={pending}
            onClick={() => act("contractions")}
            className="hud-action min-h-14 disabled:opacity-50"
          >
            <Activity className="h-5 w-5 text-[#A77ACB]" />
            <span>Breathe through it</span>
          </button>
          <button
            type="button"
            disabled={pending || labor.atHospital}
            onClick={() => act("go_to_hospital")}
            className="hud-action min-h-14 disabled:opacity-50"
          >
            <Hourglass className="h-5 w-5 text-[#A77ACB]" />
            <span>{labor.atHospital ? "At hospital" : "Go to hospital"}</span>
          </button>
          <button
            type="button"
            disabled={pending || !data.partner?.linked}
            onClick={() =>
              act("ask_partner", { request: `${data.user.name} needs you — she's in labor.` })
            }
            className="hud-action min-h-14 disabled:opacity-50"
          >
            <Heart className="h-5 w-5 text-[#A77ACB]" />
            <span>I need you</span>
          </button>
        </div>
        <p className="mt-2 text-center hud-muted italic">
          Contractions, your waters and the birth itself happen on their own — nothing here can
          speed that up or slow it down.
        </p>
      </Panel>
    </div>
  );
}
