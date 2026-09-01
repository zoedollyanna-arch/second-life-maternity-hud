import { createFileRoute } from "@tanstack/react-router";
import { useRef, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Heart,
  Droplet,
  HandHeart,
  Stethoscope,
  Briefcase,
  Bell,
  Moon,
  Sparkles,
  Loader2,
  Home,
  Activity,
  MoreHorizontal,
  ChevronLeft,
  Check,
  Trophy,
  Wind,
  Baby,
  Footprints,
  ClipboardList,
  Settings,
  Hourglass,
} from "lucide-react";
import logo from "@/assets/nestoria-logo.png";
import { Toaster } from "@/components/ui/sonner";
import {
  HudFrame,
  Panel,
  PanelHeader,
  PrimaryButton,
  Row,
  Shell,
  CloudBar,
  useHudZoom,
} from "@/components/hud/chrome";
import { useHudState, useHudAction, type HudState } from "@/lib/hud-api";
import {
  PARTNER_ACTIONS,
  LABOR_PHASE_LABEL,
  REACTION_STYLES,
  PARTNER_TITLES,
  type PartnerActionDef,
} from "@/lib/partner";
import { HospitalBagPanels, MilestonesPanel } from "@/components/hud/partner-panels";
import { playForAction, playChime, playError, playHearts } from "@/lib/sounds";

export const Route = createFileRoute("/partner")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: PartnerPage,
});

type PartnerNav = "home" | "mom" | "labor" | "bag" | "more";

const DOCK: { key: PartnerNav; label: string; icon: React.ComponentType }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "mom", label: "Mom", icon: Heart },
  { key: "labor", label: "Labor", icon: Activity },
  { key: "bag", label: "Bag", icon: Briefcase },
  { key: "more", label: "More", icon: MoreHorizontal },
];

// ---------------------------------------------------------------------------
// Shell states
// ---------------------------------------------------------------------------

function Centered({ children }: { children: React.ReactNode }) {
  const hudZoom = useHudZoom();
  return (
    <Shell>
      <HudFrame {...hudZoom}>
        <div className="flex h-full min-h-0 items-center justify-center px-6">{children}</div>
      </HudFrame>
      <Toaster position="top-center" />
    </Shell>
  );
}

function PartnerPage() {
  const { token } = Route.useSearch();
  const state = useHudState(token ?? null);
  const hudZoom = useHudZoom();

  if (!token) {
    return (
      <Centered>
        <Panel className="w-full max-w-[36rem] text-center">
          <img src={logo} alt="Nestoria" className="mx-auto h-16 w-16" />
          <h1 className="hud-brand mt-3">Nestoria Partner</h1>
          <p className="mt-3 hud-copy">
            Wear the Partner HUD in Second Life and enter her pairing code. This screen loads
            automatically on the HUD face.
          </p>
        </Panel>
      </Centered>
    );
  }

  if (state.isLoading) {
    return (
      <Shell>
        <HudFrame {...hudZoom}>
          <div className="flex min-h-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-[color:var(--lavender-deep)]" />
          </div>
        </HudFrame>
      </Shell>
    );
  }

  // No active link yet: either she hasn't accepted, or there is no link at all.
  // Both land here, because the server refuses to resolve a pregnancy without
  // an active link — which is exactly the protection we want.
  if (state.isError || !state.data || state.data.error) {
    return (
      <Centered>
        <Panel className="w-full max-w-[36rem] text-center">
          <img src={logo} alt="" className="mx-auto h-14 w-14" />
          <PanelHeader
            eyebrow="Waiting"
            title="Not linked yet"
            subtitle="Her HUD has to accept before this screen unlocks."
          />
          <p className="hud-copy">
            Touch the Partner HUD and enter the 6-character code from the Partner panel on her
            Pregnancy HUD. If you already sent it, she just needs to tap Accept.
          </p>
        </Panel>
      </Centered>
    );
  }

  return <PartnerDashboard token={token} />;
}

// ---------------------------------------------------------------------------
// Availability — a button is enabled only when the action can really happen
// ---------------------------------------------------------------------------

interface Gate {
  enabled: boolean;
  reason: string;
  needsConsent: boolean;
}

function gateFor(def: PartnerActionDef, data: HudState): Gate {
  const perms = data.partner.permissions;
  const labor = data.pregnancy.labor;
  const delivered = data.pregnancy.delivered;
  const allowed = perms ? perms[def.permission] !== false : true;
  const needsConsent = def.consent && perms?.autoAccept?.[def.action] !== true;

  if (!allowed) return { enabled: false, reason: def.unavailable, needsConsent };

  switch (def.availability) {
    case "labor":
      if (delivered) return { enabled: false, reason: "Labor is over — she did it.", needsConsent };
      if (!labor?.inLabor) return { enabled: false, reason: def.unavailable, needsConsent };
      break;
    case "birth":
      if (labor?.phase !== "pushing")
        return { enabled: false, reason: def.unavailable, needsConsent };
      break;
    case "kick": {
      const recent = data.sharedEvents.find((e) => e.type === "BABY_KICKED");
      const fresh = recent && Date.now() - new Date(recent.created_at).getTime() < 10 * 60 * 1000;
      if (!fresh) return { enabled: false, reason: def.unavailable, needsConsent };
      break;
    }
    case "delivered":
      if (!delivered) return { enabled: false, reason: def.unavailable, needsConsent };
      break;
  }

  if (def.action === "partner_water" && labor?.inLabor) {
    return {
      enabled: false,
      reason: "No water during labor — offer ice chips instead.",
      needsConsent,
    };
  }
  return { enabled: true, reason: "", needsConsent };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function PartnerDashboard({ token }: { token: string }) {
  const state = useHudState(token);
  const data = state.data!;
  const action = useHudAction(token);
  const hudZoom = useHudZoom();
  const [active, setActive] = useState<PartnerNav>("home");
  const [moreScreen, setMoreScreen] = useState<MoreScreenKey | null>(null);

  const unreadRef = useRef(data.unread);
  const laborRef = useRef(data.pregnancy.labor?.phase);
  const seenEvent = useRef<string | null>(null);

  useEffect(() => {
    if (data.unread > unreadRef.current) playChime();
    unreadRef.current = data.unread;
  }, [data.unread]);

  // Labor is authoritative and arrives from the server — the HUD reacts to it,
  // it never decides it. Entering labor pulls the partner straight to Labor.
  useEffect(() => {
    const phase = data.pregnancy.labor?.phase;
    if (phase && phase !== laborRef.current) {
      if (phase !== "none" && phase !== "delivered" && laborRef.current === "none") {
        setActive("labor");
        setMoreScreen(null);
        playChime();
      }
      laborRef.current = phase;
    }
  }, [data.pregnancy.labor?.phase]);

  // Surface the newest important event once.
  useEffect(() => {
    const top = data.sharedEvents[0];
    if (!top || seenEvent.current === null) {
      seenEvent.current = top?.id ?? null;
      return;
    }
    if (top.id !== seenEvent.current) {
      seenEvent.current = top.id;
      if (["labor", "urgent", "birth", "milestone"].includes(top.severity)) {
        toast(top.title, { description: top.body ?? undefined });
        if (top.severity === "birth" || top.severity === "milestone") playHearts();
      }
    }
  }, [data.sharedEvents]);

  const act = (name: string, params?: Record<string, unknown>) =>
    action.mutate(
      { action: name, params },
      {
        onSuccess: (res) => {
          if (res.ok === false) {
            toast.error(res.message);
            playError();
            return;
          }
          toast.success(res.message);
          playForAction(name);
        },
        onError: (err) => {
          toast.error(err.message);
          playError();
        },
      },
    );

  const preg = data.pregnancy;
  const labor = preg.labor;
  const momName = data.partner.name ?? "your partner";
  const title = (data.settings?.partnerTitle as string) ?? "Partner";

  const openMore = (screen: typeof moreScreen) => {
    setMoreScreen(screen);
    setActive("more");
  };

  return (
    <Shell>
      <HudFrame {...hudZoom}>
        <div className="hud-app">
          <header className="hud-topbar">
            <button
              type="button"
              onClick={() => {
                setActive("home");
                setMoreScreen(null);
              }}
              className="flex min-w-0 items-center gap-3 text-left"
            >
              <img src={logo} alt="" className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <div className="hud-brand truncate">NESTORIA</div>
                <div className="hud-subtitle truncate">{title} · stay close</div>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => openMore("alerts")}
                aria-label="Alerts"
                className="hud-icon-btn relative"
              >
                <Bell className="h-5 w-5" />
                {data.unread > 0 && <span className="hud-unread">{data.unread}</span>}
              </button>
            </div>
          </header>

          {labor?.inLabor && (
            <div className="shrink-0 rounded-2xl bg-[#F6C6D6]/40 px-3 py-1.5 text-center">
              <span className="hud-copy font-semibold">
                {LABOR_PHASE_LABEL[labor.phase]} · contractions {labor.intensity}%
                {labor.waterBroken ? " · water broken" : ""}
              </span>
            </div>
          )}
          {preg.delivered && (
            <div className="shrink-0 rounded-2xl bg-white/80 px-3 py-1.5 text-center">
              <span className="hud-copy font-semibold">
                Your little one has arrived{preg.babyName ? ` — ${preg.babyName}` : ""} ♥
              </span>
            </div>
          )}

          <div className="hud-stage">
            <main className="hud-main is-scroll">
              {active === "home" && (
                <HomeScreen data={data} act={act} pending={action.isPending} onOpen={openMore} />
              )}
              {active === "mom" && (
                <MomScreen data={data} act={act} pending={action.isPending} momName={momName} />
              )}
              {active === "labor" && (
                <LaborScreen data={data} act={act} pending={action.isPending} />
              )}
              {active === "bag" && (
                <HospitalBagPanels data={data} act={act} pending={action.isPending} />
              )}
              {active === "more" && (
                <MoreScreen
                  data={data}
                  act={act}
                  pending={action.isPending}
                  screen={moreScreen}
                  setScreen={setMoreScreen}
                />
              )}
            </main>
          </div>

          <nav className="hud-dock" aria-label="Primary">
            {DOCK.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`hud-dock-btn ${active === key ? "is-active" : ""}`}
                onClick={() => {
                  setActive(key);
                  if (key !== "more") setMoreScreen(null);
                }}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </HudFrame>
      <Toaster position="top-center" />
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// A button that always tells the truth about why it can't be pressed
// ---------------------------------------------------------------------------

function ActionButton({
  actionKey,
  data,
  act,
  pending,
  icon: Icon,
  label,
}: {
  actionKey: string;
  data: HudState;
  act: (name: string, params?: Record<string, unknown>) => void;
  pending: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
}) {
  const def = PARTNER_ACTIONS[actionKey];
  if (!def) return null;
  const gate = gateFor(def, data);
  const waiting = data.requests.outgoing.some((r) => r.actionType === actionKey);

  return (
    <button
      type="button"
      onClick={() => (gate.enabled ? act(def.action) : toast(gate.reason))}
      disabled={pending || waiting}
      aria-disabled={!gate.enabled}
      title={gate.enabled ? undefined : gate.reason}
      className={`hud-action min-h-14 ${gate.enabled ? "" : "opacity-45"} disabled:opacity-40`}
    >
      {waiting ? (
        <Hourglass className="h-4 w-4 text-[#A77ACB]" />
      ) : (
        Icon && <Icon className="h-4 w-4 text-[#A77ACB]" />
      )}
      <span>{waiting ? "Waiting…" : (label ?? def.label)}</span>
      {gate.enabled && gate.needsConsent && !waiting && (
        <span className="hud-label opacity-70">asks first</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// HOME
// ---------------------------------------------------------------------------

function HomeScreen({
  data,
  act,
  pending,
  onOpen,
}: {
  data: HudState;
  act: (name: string, params?: Record<string, unknown>) => void;
  pending: boolean;
  onOpen: (s: "milestones" | "appointments" | "alerts") => void;
}) {
  const preg = data.pregnancy;
  const labor = preg.labor;
  const perms = data.partner.permissions;
  const show = (key: string) => (perms ? perms[key] !== false : true);
  const dueDate = useMemo(
    () =>
      new Date(preg.dueDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [preg.dueDate],
  );
  const latest = data.sharedEvents[0];
  const milestone = data.milestones[0];
  const bag = data.hospitalBag;

  return (
    <div className="space-y-2">
      <Panel>
        <PanelHeader
          eyebrow="Connected"
          title={data.partner.name ?? "Your partner"}
          subtitle={
            show("viewWeek")
              ? `Week ${preg.week}+${preg.day} · due ${dueDate}`
              : "She has kept the details private."
          }
        />
        {show("viewWeek") && <CloudBar value={preg.progressPct} />}
        <div className="mt-2 grid grid-cols-2 gap-2">
          {show("viewStage") && <Row label="Stage" value={preg.baby.size} />}
          {show("viewKicks") && <Row label="Kicks today" value={`${preg.baby.kicksToday}`} />}
          {show("viewLabor") && (
            <Row
              label="Labor"
              value={
                preg.delivered
                  ? "Delivered ♥"
                  : labor
                    ? LABOR_PHASE_LABEL[labor.phase]
                    : "Not active"
              }
            />
          )}
          {bag && <Row label="Hospital bag" value={`${bag.packed}/${bag.total}`} />}
        </div>
        {latest && (
          <p className="mt-2 text-center hud-muted italic">
            Latest: {latest.title}
            {latest.body ? ` — ${latest.body}` : ""}
          </p>
        )}
      </Panel>

      {labor?.hospitalAdvised && !labor.atHospital && !preg.delivered && (
        <Panel>
          <PanelHeader eyebrow="Now" title="Time for the hospital" />
          <p className="text-center hud-copy">
            Labor is established. She decides when to go — be ready to leave with her.
          </p>
        </Panel>
      )}

      <Panel>
        <PanelHeader eyebrow="Be there" title="Quick support" />
        <div className="hud-care-grid">
          <ActionButton
            actionKey="partner_comfort"
            data={data}
            act={act}
            pending={pending}
            icon={Heart}
          />
          <ActionButton actionKey="hug" data={data} act={act} pending={pending} icon={HandHeart} />
          <ActionButton actionKey="kiss" data={data} act={act} pending={pending} icon={Sparkles} />
          <ActionButton
            actionKey="partner_check_on"
            data={data}
            act={act}
            pending={pending}
            icon={Stethoscope}
            label="Check on her"
          />
          <ActionButton
            actionKey="partner_help_rest"
            data={data}
            act={act}
            pending={pending}
            icon={Moon}
          />
          <ActionButton
            actionKey="partner_ice_chips"
            data={data}
            act={act}
            pending={pending}
            icon={Droplet}
          />
          <ActionButton
            actionKey="partner_labor_support"
            data={data}
            act={act}
            pending={pending}
            icon={Activity}
          />
          <ActionButton
            actionKey="feel_baby_kick"
            data={data}
            act={act}
            pending={pending}
            icon={Footprints}
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-2 min-[800px]:grid-cols-3">
        <button type="button" className="hud-card text-left" onClick={() => onOpen("milestones")}>
          <div className="hud-label">Milestones</div>
          <div className="hud-copy font-semibold">{milestone ? milestone.title : "None yet"}</div>
        </button>
        <button type="button" className="hud-card text-left" onClick={() => onOpen("appointments")}>
          <div className="hud-label">Appointments</div>
          <div className="hud-copy font-semibold">
            {show("viewAppointments") ? "View & attend" : "Private"}
          </div>
        </button>
        <button type="button" className="hud-card text-left" onClick={() => onOpen("alerts")}>
          <div className="hud-label">Alerts</div>
          <div className="hud-copy font-semibold">
            {data.unread > 0 ? `${data.unread} new` : "All caught up"}
          </div>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MOM
// ---------------------------------------------------------------------------

function MomScreen({
  data,
  act,
  pending,
  momName,
}: {
  data: HudState;
  act: (name: string, params?: Record<string, unknown>) => void;
  pending: boolean;
  momName: string;
}) {
  const preg = data.pregnancy;
  const perms = data.partner.permissions;
  const show = (key: string) => (perms ? perms[key] !== false : true);
  const kickEvent = data.sharedEvents.find((e) => e.type === "BABY_KICKED");
  const kickFresh =
    kickEvent && Date.now() - new Date(kickEvent.created_at).getTime() < 10 * 60 * 1000;

  return (
    <div className="space-y-2">
      <Panel>
        <PanelHeader
          eyebrow="How she is"
          title={show("viewMood") && data.mood ? `${data.mood.emoji} ${data.mood.label}` : momName}
          subtitle={show("viewWeek") ? `Week ${preg.week}+${preg.day}` : undefined}
        />
        {show("viewMood") && data.mood && <p className="text-center hud-copy">{data.mood.hint}</p>}
        <PrimaryButton onClick={() => act("partner_status")} disabled={pending}>
          <Stethoscope className="mr-2 inline h-4 w-4" /> Check on her
        </PrimaryButton>
      </Panel>

      {show("viewSymptoms") && data.symptoms.length > 0 && (
        <Panel>
          <PanelHeader eyebrow="Right now" title="What she's feeling" />
          <div className="space-y-2">
            {data.symptoms
              .filter((s) => s.severity > 5)
              .slice(0, 4)
              .map((s) => (
                <Row key={s.name} label={s.name} value={s.label} />
              ))}
            {data.symptoms.every((s) => s.severity <= 5) && (
              <p className="text-center hud-muted italic">Nothing bothering her right now.</p>
            )}
          </div>
        </Panel>
      )}

      {show("viewKicks") && (
        <Panel>
          <PanelHeader
            eyebrow="Baby"
            title={kickFresh ? "Baby is kicking 💕" : `${preg.baby.kicksToday} kicks today`}
            subtitle={preg.baby.size}
          />
          <div className="hud-care-grid">
            <ActionButton
              actionKey="feel_baby_kick"
              data={data}
              act={act}
              pending={pending}
              icon={Baby}
            />
            <ActionButton
              actionKey="partner_celebrate"
              data={data}
              act={act}
              pending={pending}
              icon={Trophy}
            />
          </div>
          <p className="mt-2 text-center hud-muted italic">
            You react to her kicks — you never make one happen.
          </p>
        </Panel>
      )}

      <Panel>
        <PanelHeader eyebrow="Look after her" title="Bring her something" />
        <div className="hud-care-grid">
          <ActionButton
            actionKey="partner_water"
            data={data}
            act={act}
            pending={pending}
            icon={Droplet}
          />
          <ActionButton
            actionKey="partner_medicine"
            data={data}
            act={act}
            pending={pending}
            icon={Stethoscope}
          />
          <ActionButton
            actionKey="partner_help_rest"
            data={data}
            act={act}
            pending={pending}
            icon={Moon}
          />
          <ActionButton
            actionKey="partner_backrub"
            data={data}
            act={act}
            pending={pending}
            icon={HandHeart}
          />
          <ActionButton
            actionKey="partner_comfort"
            data={data}
            act={act}
            pending={pending}
            icon={Heart}
          />
          <ActionButton
            actionKey="support"
            data={data}
            act={act}
            pending={pending}
            icon={Sparkles}
          />
        </div>
      </Panel>

      {show("viewWellness") && (
        <Panel>
          <PanelHeader eyebrow="Wellbeing" title="How she's holding up" />
          <div className="space-y-2">
            {(
              [
                ["Energy", data.stats.energy],
                ["Rest", data.stats.rest],
                ["Comfort", data.stats.comfort],
                ["Hydration", data.stats.hydration],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="hud-copy font-semibold">{label}</span>
                  <span className="hud-copy font-bold text-[#A77ACB]">{Math.round(value)}%</span>
                </div>
                <CloudBar value={value} />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LABOR
// ---------------------------------------------------------------------------

function LaborScreen({
  data,
  act,
  pending,
}: {
  data: HudState;
  act: (name: string, params?: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const preg = data.pregnancy;
  const labor = preg.labor;
  const perms = data.partner.permissions;

  if (perms && perms.viewLabor === false) {
    return (
      <Panel>
        <PanelHeader eyebrow="Labor" title="Private" />
        <p className="text-center hud-copy">
          She has chosen not to share labor details. You'll still be told when she needs you.
        </p>
      </Panel>
    );
  }

  if (preg.delivered) {
    return (
      <div className="space-y-2">
        <Panel>
          <PanelHeader
            eyebrow="It's over"
            title="She did it ♥"
            subtitle={preg.babyName ? `${preg.babyName} is here.` : "Your baby is here."}
          />
          <p className="text-center hud-copy">
            Labor support is finished. Everything you shared is kept in Milestones.
          </p>
        </Panel>
      </div>
    );
  }

  if (!labor?.inLabor) {
    return (
      <div className="space-y-2">
        <Panel>
          <PanelHeader
            eyebrow="Labor"
            title={labor?.phase === "prelabor" ? "Something is starting" : "Not in labor yet"}
            subtitle={
              labor?.phase === "prelabor"
                ? "Twinges and tightening. Stay near her."
                : "This screen wakes up on its own when labor begins."
            }
          />
          <p className="text-center hud-copy">
            Nobody chooses when this happens — not you, not her. Her body and the due date decide,
            and you'll both be told at the same moment.
          </p>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Meanwhile" title="Get ready" />
          <p className="text-center hud-muted italic">
            Finish the hospital bag now so it's done before it matters.
          </p>
        </Panel>
      </div>
    );
  }

  const minutes = labor.contractionMinutes;
  return (
    <div className="space-y-2">
      <Panel>
        <PanelHeader
          eyebrow="Contraction support"
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
          <Row label="In labor" value={`${minutes} min`} />
          <Row label="Waters" value={labor.waterBroken ? "Broken" : "Intact"} />
          <Row
            label="Hospital"
            value={labor.atHospital ? "Arrived" : labor.hospitalAdvised ? "Time to go" : "Not yet"}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Support" title="Stay with her" />
        <div className="hud-care-grid">
          <ActionButton
            actionKey="partner_labor_support"
            data={data}
            act={act}
            pending={pending}
            icon={HandHeart}
          />
          <ActionButton
            actionKey="partner_breathing"
            data={data}
            act={act}
            pending={pending}
            icon={Wind}
          />
          <ActionButton
            actionKey="partner_backrub"
            data={data}
            act={act}
            pending={pending}
            icon={Heart}
          />
          <ActionButton
            actionKey="partner_stay_strong"
            data={data}
            act={act}
            pending={pending}
            icon={Sparkles}
            label="Stay calm"
          />
          <ActionButton
            actionKey="support"
            data={data}
            act={act}
            pending={pending}
            icon={Heart}
            label="Encourage"
          />
          <ActionButton
            actionKey="partner_ice_chips"
            data={data}
            act={act}
            pending={pending}
            icon={Droplet}
          />
        </div>
        <p className="mt-2 text-center hud-muted italic">
          Ice chips only from here — no water during labor.
        </p>
      </Panel>

      {labor.phase === "pushing" && (
        <Panel>
          <PanelHeader
            eyebrow="Birth"
            title="The baby is coming"
            subtitle="Roleplay only — none of this changes what her body is doing."
          />
          <div className="hud-care-grid">
            <ActionButton
              actionKey="partner_stay_strong"
              data={data}
              act={act}
              pending={pending}
              icon={Sparkles}
            />
            <ActionButton
              actionKey="partner_faint"
              data={data}
              act={act}
              pending={pending}
              icon={Moon}
            />
            <ActionButton
              actionKey="partner_vomit_react"
              data={data}
              act={act}
              pending={pending}
              icon={Activity}
            />
          </div>
        </Panel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BAG
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MORE
// ---------------------------------------------------------------------------

type MoreScreenKey = "milestones" | "appointments" | "alerts" | "reactions" | "connection";

function MoreScreen({
  data,
  act,
  pending,
  screen,
  setScreen,
}: {
  data: HudState;
  act: (name: string, params?: Record<string, unknown>) => void;
  pending: boolean;
  screen: MoreScreenKey | null;
  setScreen: (s: MoreScreenKey | null) => void;
}) {
  if (!screen) {
    const rows: { key: MoreScreenKey; label: string; icon: React.ComponentType }[] = [
      { key: "milestones", label: "Milestones", icon: Trophy },
      { key: "appointments", label: "Appointments & scans", icon: Stethoscope },
      { key: "alerts", label: "Alerts", icon: Bell },
      { key: "reactions", label: "My reactions", icon: Sparkles },
      { key: "connection", label: "Connection", icon: Settings },
    ];
    return (
      <Panel className="is-scroll">
        <div className="hud-more-list">
          {rows.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" className="hud-more-row" onClick={() => setScreen(key)}>
              <span className="hud-tile-icon">
                <Icon />
              </span>
              {label}
            </button>
          ))}
        </div>
      </Panel>
    );
  }

  const Back = () => (
    <div className="hud-page-head">
      <button type="button" className="hud-back" onClick={() => setScreen(null)}>
        <ChevronLeft className="h-5 w-5" />
        Back
      </button>
      <h2 className="hud-title">
        {screen === "milestones"
          ? "Milestones"
          : screen === "appointments"
            ? "Appointments"
            : screen === "alerts"
              ? "Alerts"
              : screen === "reactions"
                ? "My reactions"
                : "Connection"}
      </h2>
      <span className="w-[72px] shrink-0" aria-hidden />
    </div>
  );

  const perms = data.partner.permissions;

  return (
    <div className="hud-page">
      <Back />
      {screen === "milestones" && (
        <Panel className="is-scroll">
          {perms?.viewMilestones === false ? (
            <p className="text-center hud-copy">She has kept milestones private.</p>
          ) : data.milestones.length === 0 ? (
            <p className="text-center hud-muted italic">No milestones yet — they're coming.</p>
          ) : (
            <div className="space-y-2">
              {data.milestones.map((m) => (
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
                      {m.celebratedBy.length > 0 ? "Celebrated ♥" : "Celebrate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {screen === "appointments" && (
        <Panel className="is-scroll">
          {perms?.viewAppointments === false ? (
            <p className="text-center hud-copy">She has kept appointments private.</p>
          ) : (
            <>
              <PanelHeader
                eyebrow="Together"
                title="Appointments & scans"
                subtitle="Marking yourself attending records it on her journal too."
              />
              <div className="space-y-2">
                {data.journal
                  .filter((j) => j.kind === "appointment" || j.kind === "milestone")
                  .slice(0, 8)
                  .map((j) => (
                    <div key={j.id} className="rounded-2xl bg-white/70 px-3 py-2">
                      <div className="hud-copy font-semibold">{j.title}</div>
                      {j.body && <p className="hud-muted">{j.body}</p>}
                      <span className="hud-label">{j.entry_date}</span>
                    </div>
                  ))}
                {data.journal.filter((j) => j.kind === "appointment").length === 0 && (
                  <p className="text-center hud-muted italic">Nothing scheduled yet.</p>
                )}
              </div>
              <PrimaryButton onClick={() => act("partner_appointment")} disabled={pending}>
                <ClipboardList className="mr-2 inline h-4 w-4" /> Mark me attending
              </PrimaryButton>
              {data.ultrasounds.length > 0 && (
                <>
                  <PanelHeader eyebrow="Ultrasound" title="Shared scans" />
                  <div className="grid grid-cols-3 gap-2">
                    {data.ultrasounds.slice(-6).map((u) => (
                      <div key={u.index} className="overflow-hidden rounded-xl bg-white/80">
                        <img src={u.url} alt={`Week ${u.week} scan`} className="w-full" />
                        <div className="p-1 text-center hud-label">Week {u.week}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </Panel>
      )}

      {screen === "alerts" && (
        <Panel className="is-scroll">
          <PanelHeader eyebrow="While you were away" title="Everything you missed" />
          <div className="space-y-2">
            {data.sharedEvents.length === 0 && (
              <p className="text-center hud-muted italic">Quiet so far.</p>
            )}
            {data.sharedEvents.map((e) => (
              <div key={e.id} className="rounded-2xl bg-white/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="hud-copy font-semibold">{e.title}</span>
                  <span className="hud-label shrink-0">
                    {new Date(e.created_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {e.body && <p className="hud-muted">{e.body}</p>}
              </div>
            ))}
          </div>
          {data.unread > 0 && (
            <PrimaryButton onClick={() => act("notifications_read")} disabled={pending}>
              <Bell className="mr-2 inline h-4 w-4" /> Mark read
            </PrimaryButton>
          )}
        </Panel>
      )}

      {screen === "reactions" && <ReactionSettings data={data} act={act} pending={pending} />}

      {screen === "connection" && (
        <Panel>
          <PanelHeader
            eyebrow="Connection"
            title={data.partner.name ?? "Linked"}
            subtitle="She controls what this HUD can see and do."
          />
          <div className="space-y-2">
            <Row label="Status" value="Linked ♥" />
            <Row label="Support given" value={`${data.partner.support}%`} />
          </div>
          <p className="mt-2 text-center hud-muted italic">
            To disconnect, ask her to remove the link from the Partner panel on her HUD.
          </p>
        </Panel>
      )}
    </div>
  );
}

function ReactionSettings({
  data,
  act,
  pending,
}: {
  data: HudState;
  act: (name: string, params?: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const settings = data.settings ?? {};
  const mode = (settings.reactionMode as string) ?? "manual";
  const style = (settings.reactionStyle as string) ?? "stay_strong";
  const title = (settings.partnerTitle as string) ?? "Partner";

  return (
    <div className="space-y-2">
      <Panel>
        <PanelHeader
          eyebrow="Birth reactions"
          title="How you handle it"
          subtitle="Roleplay only. Never affects her labor."
        />
        <div className="grid grid-cols-3 gap-2">
          {REACTION_STYLES.map((r) => (
            <button
              key={r.key}
              type="button"
              disabled={pending}
              onClick={() => act("partner_reaction_settings", { style: r.key })}
              className={`hud-action min-h-16 ${style === r.key ? "ring-2 ring-[#A77ACB]" : ""}`}
            >
              <span className="font-semibold">{r.label}</span>
              <span className="hud-label">{r.hint}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="When" title="Trigger" />
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["manual", "Manual", "Only when you press it"],
              ["auto", "Auto", "May fire at peak intensity"],
              ["off", "Off", "Never"],
            ] as const
          ).map(([key, label, hint]) => (
            <button
              key={key}
              type="button"
              disabled={pending}
              onClick={() => act("partner_reaction_settings", { mode: key })}
              className={`hud-action min-h-16 ${mode === key ? "ring-2 ring-[#A77ACB]" : ""}`}
            >
              <span className="font-semibold">{label}</span>
              <span className="hud-label">{hint}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Call me" title="What this HUD calls you" />
        <div className="grid grid-cols-3 gap-2 min-[800px]:grid-cols-5">
          {PARTNER_TITLES.map((t) => (
            <button
              key={t}
              type="button"
              disabled={pending}
              onClick={() => act("partner_reaction_settings", { title: t })}
              className={`hud-action min-h-12 ${title === t ? "ring-2 ring-[#A77ACB]" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
