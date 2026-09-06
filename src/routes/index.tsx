import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Home,
  Heart,
  Baby,
  Users,
  BookHeart,
  Bell,
  Settings,
  Droplet,
  Pill,
  Moon,
  Utensils,
  Zap,
  Smile,
  Footprints,
  Calendar,
  Camera,
  Sparkles,
  Plus,
  MessageCircle,
  Stethoscope,
  Copy,
  Check,
  Loader2,
  Waves,
  Apple,
  Mic,
  HandHeart,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Bath,
  CloudRain,
  Briefcase,
  HeartPulse,
  Hospital,
  MoreHorizontal,
  Activity,
} from "lucide-react";
import logo from "@/assets/nestoria-logo.png";
import pregnancyHero from "@/assets/pregnancy-hero.jpg";
import babyHero from "@/assets/baby-hero.jpg";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useHudState,
  useHudAction,
  journalPhotoSrc,
  uploadJournalPhoto,
  type HudState,
  type HudStats,
} from "@/lib/hud-api";
import {
  RequestInbox,
  LinkApprovals,
  PartnerPrivacy,
  HospitalBagPanels,
  MilestonesPanel,
  MomLaborPanels,
} from "@/components/hud/partner-panels";
import { BABY_GROWTH } from "@/lib/pregnancy";
import { FOOD_CATEGORIES, FOOD_CATEGORY_LABELS, type FoodCategory } from "@/lib/foods";
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABELS, EVENT_CATEGORY_HINTS } from "@/lib/events";
import {
  ANIMATION_KEYS,
  ANIMATION_LABELS,
  DECAY_PACES,
  PARTNER_NOTIFY_KEYS,
  PARTNER_NOTIFY_LABELS,
  POPUP_FREQUENCIES,
  POPUP_SURFACES,
  PRIVACY_MODES,
  TEST_LABOR_SPEEDS,
  normalizePreferences,
  type HudPreferences,
} from "@/lib/preferences";
import { Switch } from "@/components/ui/switch";
import {
  playForAction,
  playChime,
  playError,
  playHearts,
  playEvent,
  configureSound,
} from "@/lib/sounds";
import { LAYOUT_PREVIEW_STATE } from "@/lib/hud-preview";
import {
  CloudBar,
  Meter,
  Panel,
  PanelHeader,
  PrimaryButton,
  Row,
  Shell,
  HudFrame,
  useHudZoom,
} from "@/components/hud/chrome";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: Index,
});

type NavKey =
  | "home"
  | "pregnancy"
  | "health"
  | "baby"
  | "care"
  | "partner"
  | "labor"
  | "bag"
  | "milestones"
  | "journal"
  | "nutrition"
  | "notifications"
  | "settings"
  | "more";

const DOCK_NAV: {
  key: NavKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "pregnancy", label: "Pregnancy", icon: Sparkles },
  { key: "health", label: "Health", icon: Heart },
  { key: "baby", label: "Baby", icon: Baby },
  { key: "more", label: "More", icon: MoreHorizontal },
];

const MORE_APPS: {
  key: NavKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "care", label: "Care", icon: HandHeart },
  { key: "partner", label: "Partner", icon: Users },
  { key: "labor", label: "Labor", icon: Activity },
  { key: "bag", label: "Hospital bag", icon: Briefcase },
  { key: "journal", label: "Journal", icon: BookHeart },
  { key: "milestones", label: "Milestones", icon: Trophy },
  { key: "nutrition", label: "Nutrition", icon: Apple },
  { key: "notifications", label: "Alerts", icon: Bell },
  { key: "settings", label: "Settings", icon: Settings },
];

function dockKey(active: NavKey): NavKey {
  if (active === "home" || active === "pregnancy" || active === "baby" || active === "more")
    return active;
  if (active === "health" || active === "nutrition") return "health";
  if (active === "labor") return "pregnancy";
  return "more";
}

function AppPage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="hud-page">
      <div className="hud-page-head">
        <button type="button" className="hud-back" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
        <h2 className="hud-title">{title}</h2>
        <span className="w-[72px] shrink-0" aria-hidden />
      </div>
      {children}
    </div>
  );
}

const CLIENT_DECAY_PER_HOUR: Record<keyof HudStats, number> = {
  energy: -2.2,
  hydration: -3.5,
  hunger: -3,
  bladder: -4,
  mood: -0.9,
  immunity: -0.35,
  sickness: 0.7,
  rest: -2.2,
  vitamins: -1.4,
  comfort: -1.5,
  nutrition: -1,
  stress: 0.55,
  baby_wellness: -0.08,
  baby_bond: -0.12,
  baby_movement: -0.25,
};

const clampStat = (value: number) => Math.max(0, Math.min(100, value));

function smartDecayHours(hours: number) {
  const safeHours = Math.max(0, hours);
  if (safeHours <= 8) return safeHours;
  return Math.min(18, 8 + Math.sqrt(safeHours - 8) * 0.75);
}

function useLiveStats(data: HudState) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    const serverAt = new Date(data.serverTime).getTime();
    if (!Number.isFinite(serverAt)) return data.stats;

    const elapsedHours = smartDecayHours((now - serverAt) / 3_600_000);
    if (elapsedHours <= 0) return data.stats;

    const live = {} as HudStats;
    for (const key of Object.keys(data.stats) as (keyof HudStats)[]) {
      let rate = CLIENT_DECAY_PER_HOUR[key];
      if (key === "sickness") rate = data.pregnancy.trimester === 1 ? 1.1 : -1.2;
      if (key === "immunity" && data.stats.vitamins < 20) rate = -2;
      if (rate < 0 && data.stats[key] < 25) rate *= 0.45;
      if (rate > 0 && data.stats[key] > 75) rate *= 0.45;
      live[key] = clampStat(data.stats[key] + rate * elapsedHours);
    }
    return live;
  }, [data.pregnancy.trimester, data.serverTime, data.stats, now]);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

function Index() {
  const { token } = Route.useSearch();
  const layoutPreview = import.meta.env.DEV && token === "layout-preview";
  const state = useHudState(layoutPreview ? null : (token ?? null));
  const hudZoom = useHudZoom();

  if (layoutPreview) {
    return <Dashboard token="layout-preview" data={LAYOUT_PREVIEW_STATE} />;
  }

  if (!token) return <ConnectScreen />;
  if (state.isLoading) {
    return (
      <Shell>
        <HudFrame {...hudZoom}>
          <div className="flex h-full min-h-0 flex-1 items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-[color:var(--lavender-deep)]" />
              <p className="mt-4 font-display text-xl text-[color:var(--lavender-deep)]">
                Opening your nursery…
              </p>
            </div>
          </div>
        </HudFrame>
      </Shell>
    );
  }
  if (state.isError || !state.data || state.data.error) {
    return (
      <Shell>
        <HudFrame {...hudZoom}>
          <div className="flex h-full min-h-0 flex-1 items-center justify-center px-6">
            <Panel className="w-full max-w-[920px] text-center">
              <PanelHeader eyebrow="Session" title="Your session has expired" />
              <p className="text-base text-muted-foreground">
                Touch your Nestoria HUD in Second Life and choose <b>Sync</b> — it will refresh this
                screen with a new session.
              </p>
            </Panel>
          </div>
        </HudFrame>
      </Shell>
    );
  }
  return <Dashboard token={token} data={state.data} />;
}

function ConnectScreen() {
  const hudZoom = useHudZoom();
  const [starting, setStarting] = useState(false);
  const startDemo = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/hud/demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.token) throw new Error(data.error ?? "Demo unavailable");
      window.location.search = `?token=${data.token}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Demo unavailable");
      setStarting(false);
    }
  };
  return (
    <Shell>
      <HudFrame {...hudZoom}>
        <div className="hud-app">
          <div className="grid h-full min-h-0 min-w-0 grid-cols-1 gap-4 min-[800px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Panel className="flex min-h-0 flex-col items-center justify-center text-center">
              <img
                src={logo}
                alt="Nestoria logo"
                width={88}
                height={88}
                className="h-[clamp(56px,8vh,88px)] w-[clamp(56px,8vh,88px)]"
                style={{ animation: "float 5s ease-in-out infinite" }}
              />
              <h1 className="hud-brand mt-3">NESTORIA</h1>
              <p className="font-script text-[clamp(16px,2vw,22px)] text-[#A77ACB]">
                where every family journey begins
              </p>
              <p className="mt-2 hud-muted">Pregnancy & Family HUD</p>
            </Panel>
            <Panel className="flex min-h-0 flex-col justify-center">
              <div className="space-y-2 hud-copy">
                <p className="font-semibold">To open your dashboard:</p>
                <p>
                  1. Wear the <b>Nestoria HUD</b> in Second Life.
                </p>
                <p>2. It registers automatically and loads this dashboard on its screen.</p>
                <p>
                  3. Enable media: <i>Preferences → Sound &amp; Media → Media</i>.
                </p>
                <p>
                  Partners: wear the <b>Partner HUD</b> and enter the pairing code from her Partner
                  panel.
                </p>
              </div>
              <PrimaryButton onClick={startDemo} disabled={starting}>
                {starting ? "Starting demo…" : "Preview a demo dashboard"}
              </PrimaryButton>
            </Panel>
          </div>
        </div>
      </HudFrame>
      <Toaster position="top-center" />
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function Dashboard({ token, data }: { token: string; data: HudState }) {
  const [active, setActive] = useState<NavKey>("home");
  const backTo = useRef<NavKey>("home");
  const hudZoom = useHudZoom();
  const action = useHudAction(token);

  const openApp = (key: NavKey, from: NavKey = "home") => {
    backTo.current = from;
    setActive(key);
  };
  const goBack = () => setActive(backTo.current === active ? "home" : backTo.current);

  const act = (name: string, params?: Record<string, unknown>, opts?: { silent?: boolean }) =>
    action.mutate(
      { action: name, params },
      {
        onSuccess: (res) => {
          if (opts?.silent) return;
          toast.success(res.message);
          playForAction(name);
        },
        onError: (err) => {
          if (opts?.silent) return;
          toast.error(err.message);
          playError();
        },
      },
    );

  // Her Sound preference reaches the audio layer here, once per refresh, so
  // every button and every notification respects it without threading it
  // through the whole tree.
  const soundOn = data.preferences?.soundEnabled ?? true;
  const soundVol = data.preferences?.soundVolume ?? 70;
  useEffect(() => {
    configureSound({ enabled: soundOn, volume: soundVol });
  }, [soundOn, soundVol]);

  // Chime when new notifications arrive (heard in SL through the media screen)
  const unreadRef = useRef(data.unread);
  useEffect(() => {
    if (data.unread > unreadRef.current) playChime();
    unreadRef.current = data.unread;
  }, [data.unread]);

  // A distinct prompt for an RP moment waiting on an answer — it is a question,
  // not a notification, and it should not sound like one.
  const activeEventId = data.activeEvent?.id ?? null;
  const lastEventRef = useRef<string | null>(activeEventId);
  useEffect(() => {
    if (activeEventId && activeEventId !== lastEventRef.current) playEvent();
    lastEventRef.current = activeEventId;
  }, [activeEventId]);

  // Celebrate freshly unlocked ultrasound photos
  const scanCountRef = useRef(data.ultrasounds.length);
  useEffect(() => {
    if (data.ultrasounds.length > scanCountRef.current) {
      toast("📸 You have a new ultrasound ♥", {
        description: "Open your scrapbook on the Baby panel to see it.",
      });
      playHearts();
    }
    scanCountRef.current = data.ultrasounds.length;
  }, [data.ultrasounds.length]);

  const preg = data.pregnancy;
  const stats = useLiveStats(data);
  const dueDate = useMemo(
    () =>
      new Date(preg.dueDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [preg.dueDate],
  );
  const nextMilestone = useMemo(
    () => BABY_GROWTH.find((m) => m.week > preg.week) ?? BABY_GROWTH[BABY_GROWTH.length - 1],
    [preg.week],
  );
  const trimesterLabel =
    preg.trimester === 1
      ? "1st Trimester"
      : preg.trimester === 2
        ? "2nd Trimester"
        : "3rd Trimester";
  const homeTiles: {
    key: NavKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { key: "pregnancy", label: "Pregnancy", icon: Sparkles },
    { key: "health", label: "Health", icon: Heart },
    { key: "care", label: "Care", icon: HandHeart },
    { key: "partner", label: "Partner", icon: Users },
    { key: "journal", label: "Journal", icon: BookHeart },
    { key: "baby", label: "Baby", icon: Baby },
    { key: "bag", label: "Hospital bag", icon: Briefcase },
    { key: "milestones", label: "Milestones", icon: Trophy },
  ];

  if (!preg.setupComplete && data.user.role === "mom") {
    return (
      <SetupWizard token={token} data={data} onSave={(params) => act("setup_update", params)} />
    );
  }

  const pageScrolls = active !== "home";

  return (
    <Shell>
      <HudFrame {...hudZoom}>
        <div className="hud-app">
          <header className="hud-topbar">
            <button
              type="button"
              onClick={() => setActive("home")}
              className="flex min-w-0 items-center gap-3 text-left"
            >
              <img
                src={logo}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-xl"
              />
              <div className="min-w-0">
                <div className="hud-brand truncate">NESTORIA</div>
                <div className="hud-subtitle truncate">Pregnancy & Family</div>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => openApp("notifications")}
                aria-label="Notifications"
                className="hud-icon-btn relative"
              >
                <Bell className="h-5 w-5" />
                {data.unread > 0 && <span className="hud-unread">{data.unread}</span>}
              </button>
              <button
                type="button"
                onClick={() => openApp("settings")}
                aria-label="Settings"
                className="hud-icon-btn"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </header>

          {preg.delivered && (
            <div className="shrink-0 rounded-2xl bg-white/80 px-3 py-1.5 text-center">
              <span className="hud-copy font-semibold">
                Your little one has arrived
                {preg.babyName ? ` — ${preg.babyName}` : ""}.
              </span>
            </div>
          )}

          {data.activeEvent && data.preferences?.popupSurface !== "world" && (
            <EventCard
              event={data.activeEvent}
              pending={action.isPending}
              onChoose={(choice) =>
                act("random_event_choice", {
                  choice,
                  eventId: data.activeEvent!.id,
                  eventType: data.activeEvent!.key,
                })
              }
              onDismiss={() => act("event_dismiss")}
            />
          )}

          <div className="hud-stage">
            <main className={`hud-main ${pageScrolls ? "is-scroll" : ""}`}>
              {active === "home" && (
                <div className="hud-home">
                  {(data.requests?.incoming?.length ?? 0) > 0 && (
                    <section>
                      <RequestInbox data={data} act={act} pending={action.isPending} />
                    </section>
                  )}
                  {(data.partner?.pendingLinks?.length ?? 0) > 0 && (
                    <section>
                      <LinkApprovals data={data} act={act} pending={action.isPending} />
                    </section>
                  )}
                  <section>
                    <button
                      type="button"
                      className="hud-card w-full text-left"
                      onClick={() => openApp("pregnancy")}
                    >
                      <div className="hud-overview-strip">
                        <img src={pregnancyHero} alt="" loading="lazy" />
                        <div className="hud-overview-meta">
                          <div className="hud-stat">
                            {preg.week}W + {preg.day}D
                          </div>
                          <div className="hud-copy">{trimesterLabel}</div>
                          <CloudBar value={preg.progressPct} />
                        </div>
                        <div className="hud-overview-facts">
                          <div className="hud-overview-fact">
                            <div className="hud-label">Due</div>
                            <div className="hud-copy truncate">{dueDate}</div>
                          </div>
                          <div className="hud-overview-fact">
                            <div className="hud-label">Size</div>
                            <div className="hud-copy truncate">{preg.baby.size}</div>
                          </div>
                        </div>
                      </div>
                    </button>
                  </section>

                  <section className="min-h-0">
                    <div className="hud-tiles">
                      {homeTiles.map(({ key, label, icon: Icon }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => openApp(key)}
                          className="hud-tile"
                        >
                          <span className="hud-tile-icon">
                            <Icon />
                          </span>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {active === "more" && (
                <AppPage title="More" onBack={() => setActive("home")}>
                  <Panel className="is-scroll">
                    <div className="hud-more-list">
                      {MORE_APPS.map(({ key, label, icon: Icon }) => (
                        <button
                          key={label}
                          type="button"
                          className="hud-more-row"
                          onClick={() => openApp(key, "more")}
                        >
                          <span className="hud-tile-icon">
                            <Icon />
                          </span>
                          {label}
                        </button>
                      ))}
                    </div>
                  </Panel>
                </AppPage>
              )}

              {active === "pregnancy" && (
                <AppPage title="Pregnancy" onBack={goBack}>
                  <Panel className="is-scroll">
                    <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3">
                      <div className="relative mx-auto aspect-square w-full max-w-[180px] overflow-hidden rounded-full ring-4 ring-white/70">
                        <img
                          src={pregnancyHero}
                          alt="Pregnancy"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="hud-stat">
                          {preg.week}W + {preg.day}D
                        </div>
                        <p className="hud-muted">
                          {trimesterLabel} · Due {dueDate} · {preg.daysToGo} days remaining
                        </p>
                        <CloudBar value={preg.progressPct} />
                        <div className="grid grid-cols-2 gap-2">
                          <Row label="Baby size" value={preg.baby.size} />
                          <Row label="Current stage" value={trimesterLabel} />
                          <Row
                            label="Next milestone"
                            value={`Week ${nextMilestone.week} · ${nextMilestone.size}`}
                          />
                          <Row
                            label="Kicks today"
                            value={`${preg.baby.kicksToday}`}
                            icon={<Footprints className="h-3.5 w-3.5 text-[#A77ACB]" />}
                          />
                        </div>
                      </div>
                    </div>
                    <TimelineDialog currentWeek={preg.week} />
                    <div className="mt-3 hud-care-grid">
                      <button onClick={() => act("feel_kick")} className="hud-action">
                        Feel kick
                      </button>
                      <button onClick={() => act("count_kick")} className="hud-action">
                        Count kick
                      </button>
                      <button onClick={() => act("appointment")} className="hud-action">
                        Appointment
                      </button>
                      <button onClick={() => act("ultrasound")} className="hud-action">
                        Ultrasound
                      </button>
                      {!preg.delivered && (
                        <>
                          <button onClick={() => act("contractions")} className="hud-action">
                            Contractions
                          </button>
                          <button onClick={() => act("go_to_hospital")} className="hud-action">
                            Hospital
                          </button>
                        </>
                      )}
                    </div>
                    {preg.labor && preg.labor.stage !== "none" && (
                      <p className="mt-2 text-center hud-muted">
                        {preg.labor.waterBroken ? "Water has broken. " : ""}
                        {preg.labor.stage === "contractions" || preg.labor.intensity > 0
                          ? `Contractions ${preg.labor.intensity}% · ${preg.labor.contractionMinutes} min`
                          : preg.labor.stage.replace("_", " ")}
                      </p>
                    )}
                  </Panel>
                </AppPage>
              )}

              {active === "baby" && (
                <AppPage title={preg.babyName ?? "Baby"} onBack={goBack}>
                  <Panel className="is-scroll">
                    <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] items-center gap-3">
                      <div className="relative mx-auto aspect-square w-full max-w-[160px] overflow-hidden rounded-full ring-4 ring-white/70">
                        <img
                          src={babyHero}
                          alt="Baby"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <Row label="Baby size" value={preg.baby.size} />
                        <Row
                          label="Heartbeat"
                          value={preg.baby.heartbeat ? `${preg.baby.heartbeat} bpm` : "Too early"}
                          icon={<Heart className="h-3.5 w-3.5 text-[#F6C6D6]" />}
                        />
                        <Row label="Movement" value={preg.baby.movement} />
                        <Row
                          label="Weight"
                          value={`${(preg.baby.weightG / 453.6).toFixed(1)} lbs`}
                        />
                        <Row
                          label="Length"
                          value={`${(preg.baby.lengthCm / 2.54).toFixed(1)} in`}
                        />
                        <Row label="Kicks today" value={`${preg.baby.kicksToday}`} />
                      </div>
                    </div>
                    <p className="mt-2 text-center hud-muted italic">{preg.baby.note}</p>
                    <PrimaryButton onClick={() => act("kick")}>Log a kick</PrimaryButton>
                    <ScrapbookDialog
                      ultrasounds={data.ultrasounds}
                      newCount={data.newUltrasounds}
                      babyName={preg.babyName}
                      onOpened={() => {
                        if (data.newUltrasounds > 0)
                          act("ultrasound_seen", undefined, { silent: true });
                      }}
                    />
                  </Panel>
                </AppPage>
              )}

              {active === "health" && (
                <AppPage title="Health" onBack={goBack}>
                  <Panel className="is-scroll">
                    <div className="hud-meters">
                      <Meter icon={Heart} label="Sickness" value={stats.sickness} tone="blush" />
                      <Meter icon={Zap} label="Energy" value={stats.energy} />
                      <Meter icon={Utensils} label="Hunger" value={stats.hunger} />
                      <Meter icon={Smile} label="Mood" value={stats.mood} tone="blush" />
                      <Meter icon={Droplet} label="Bladder" value={stats.bladder} />
                      <Meter icon={Droplet} label="Hydration" value={stats.hydration} />
                    </div>
                    {data.mood && (
                      <p className="mt-2 hud-copy">
                        {data.mood.emoji} {data.mood.label} — {data.mood.hint}
                      </p>
                    )}
                    <div className="hud-care-grid mt-3">
                      <button type="button" className="hud-action" onClick={() => act("doctor")}>
                        <Stethoscope className="h-6 w-6 shrink-0 text-[#A77ACB]" />
                        <span>Doctor</span>
                      </button>
                      <button
                        type="button"
                        className="hud-action"
                        onClick={() => openApp("nutrition", "health")}
                      >
                        <Apple className="h-6 w-6 shrink-0 text-[#A77ACB]" />
                        <span>Nutrition</span>
                      </button>
                    </div>
                    <div className="hud-label mt-4 mb-2">Symptoms</div>
                    <div className="hud-symptom-list">
                      {data.symptoms.map((s) => (
                        <div key={s.name} className="hud-symptom-row">
                          <span className="font-semibold">{s.name}</span>
                          <span className="hud-muted">{s.label}</span>
                        </div>
                      ))}
                    </div>
                    <SymptomsDialog
                      symptoms={data.symptoms}
                      onSave={(name, severity) => act("symptom_log", { name, severity })}
                    />
                  </Panel>
                </AppPage>
              )}

              {active === "care" && (
                <AppPage title="Care" onBack={goBack}>
                  <Panel className="is-scroll">
                    <div className="hud-care-grid">
                      {[
                        { icon: Moon, label: "Rest", action: "rest" },
                        { icon: Droplet, label: "Water", action: "drink_water" },
                        { icon: Pill, label: "Vitamins", action: "vitamins" },
                        { icon: Heart, label: "Comfort", action: "comfort" },
                        { icon: Stethoscope, label: "Medicine", action: "medicine" },
                        { icon: Moon, label: "Sleep", action: "sleep" },
                        { icon: Bath, label: "Bathroom", action: "bathroom" },
                        { icon: CloudRain, label: "Be sick", action: "vomit" },
                        { icon: Smile, label: "Cry", action: "cry" },
                        { icon: Briefcase, label: "Pack bag", action: "pack_bag" },
                      ].map(({ icon: Icon, label, action: name }) => (
                        <button
                          key={label}
                          type="button"
                          className="hud-action"
                          disabled={action.isPending}
                          onClick={() => act(name)}
                        >
                          <Icon className="h-6 w-6 shrink-0 text-[#A77ACB]" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                    {data.partner.linked && (
                      <button
                        type="button"
                        onClick={() =>
                          act("ask_partner", {
                            request: `${data.user.name} could use a little support right now.`,
                          })
                        }
                        className="mt-3 min-h-12 w-full rounded-full bg-white/70 hud-copy font-semibold text-[#A77ACB]"
                      >
                        Ask partner for support
                      </button>
                    )}
                  </Panel>
                </AppPage>
              )}

              {active === "partner" && (
                <AppPage title="Partner" onBack={goBack}>
                  <LinkApprovals data={data} act={act} pending={action.isPending} />
                  <RequestInbox data={data} act={act} pending={action.isPending} />
                  <Panel className="is-scroll">
                    {data.partner.linked ? (
                      <>
                        <div className="mb-3 rounded-2xl bg-white/70 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="hud-label">Connected partner</div>
                              <div className="hud-title truncate">{data.partner.name}</div>
                              <div className="hud-muted">
                                Linked · {data.partner.support}% support
                              </div>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F6C6D6]/50">
                              <Heart className="h-5 w-5 text-[#A77ACB]" />
                            </div>
                          </div>
                          <CloudBar value={data.partner.support} tone="blush" />
                        </div>
                        <div className="mb-3 hud-care-grid">
                          <button type="button" className="hud-action" onClick={() => act("hug")}>
                            <HandHeart className="h-6 w-6 text-[#A77ACB]" />
                            <span>Send hug</span>
                          </button>
                          <button
                            type="button"
                            className="hud-action"
                            onClick={() =>
                              act("ask_partner", { request: `${data.user.name} could use water.` })
                            }
                          >
                            <Droplet className="h-6 w-6 text-[#A77ACB]" />
                            <span>Ask for water</span>
                          </button>
                          <button
                            type="button"
                            className="hud-action"
                            onClick={() =>
                              act("ask_partner", { request: `${data.user.name} could use rest.` })
                            }
                          >
                            <Moon className="h-6 w-6 text-[#A77ACB]" />
                            <span>Ask to rest</span>
                          </button>
                          <button
                            type="button"
                            className="hud-action"
                            onClick={() =>
                              act("ask_partner", {
                                request: `${data.user.name} could use a little support right now.`,
                              })
                            }
                          >
                            <MessageCircle className="h-6 w-6 text-[#A77ACB]" />
                            <span>Support</span>
                          </button>
                        </div>
                        <div className="hud-label mb-1">Recent activities</div>
                        <ul className="space-y-1.5">
                          {data.partner.activities.length === 0 && (
                            <li className="rounded-xl bg-white/50 px-3 py-2 hud-muted italic">
                              No activities yet — they'll appear when your partner uses their HUD.
                            </li>
                          )}
                          {data.partner.activities.map((a, i) => (
                            <li
                              key={i}
                              className="flex items-center justify-between rounded-xl bg-white/50 px-3 py-2 hud-copy"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <Heart className="h-3.5 w-3.5 shrink-0 text-[#F6C6D6]" />
                                <span className="truncate">{a.activity}</span>
                              </span>
                              <span className="hud-muted shrink-0 italic">
                                {new Date(a.created_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <div className="text-center">
                        <p className="mb-3 hud-copy text-muted-foreground">
                          Give this pairing code to your partner. They enter it in their{" "}
                          <b>Nestoria Partner HUD</b> to join your journey.
                        </p>
                        <PairingCode code={data.partner.code} />
                        <p className="mt-3 hud-muted italic">
                          Once linked, their hugs, water runs and sweet messages show up here — and
                          reach you in-world.
                        </p>
                      </div>
                    )}
                  </Panel>
                  <PartnerPrivacy data={data} act={act} pending={action.isPending} />
                </AppPage>
              )}

              {active === "labor" && (
                <AppPage title="Labor" onBack={goBack}>
                  <MomLaborPanels data={data} act={act} pending={action.isPending} />
                </AppPage>
              )}

              {active === "bag" && (
                <AppPage title="Hospital bag" onBack={goBack}>
                  <HospitalBagPanels data={data} act={act} pending={action.isPending} />
                </AppPage>
              )}

              {active === "milestones" && (
                <AppPage title="Milestones" onBack={goBack}>
                  <MilestonesPanel data={data} act={act} pending={action.isPending} />
                </AppPage>
              )}

              {active === "journal" && (
                <AppPage title="Journal" onBack={goBack}>
                  <Panel className="is-scroll">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <JournalDialog token={token} onSave={(entry) => act("journal_add", entry)} />
                      <MemoryDialog onSave={(entry) => act("memory", entry)} />
                      <EventDialog onSave={(entry) => act("event", entry)} />
                    </div>
                    <div className="space-y-2">
                      {data.journal.length === 0 && (
                        <p className="text-center hud-muted italic">
                          Your story starts here — add your first entry.
                        </p>
                      )}
                      {data.journal.map((m) => {
                        const Icon =
                          m.kind === "milestone"
                            ? Trophy
                            : m.kind === "memory"
                              ? Camera
                              : m.kind === "appointment"
                                ? Stethoscope
                                : BookHeart;
                        const photo = journalPhotoSrc(m.photo_url, token);
                        return (
                          <div
                            key={m.id}
                            className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/60 px-3 py-2"
                          >
                            {photo ? (
                              <img
                                src={photo}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D6C6E7]/40">
                                <Icon className="h-6 w-6 text-[#A77ACB]" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="hud-copy truncate font-semibold">{m.title}</div>
                              <div className="hud-muted italic">
                                {new Date(m.created_at).toLocaleDateString(undefined, {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </div>
                            </div>
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${m.completed ? "bg-[#D6C6E7] text-white" : "border border-[#D6C6E7]/50"}`}
                            >
                              {m.completed ? "✓" : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                </AppPage>
              )}

              {active === "nutrition" && (
                <AppPage title="Nutrition" onBack={goBack}>
                  <Panel className="is-scroll">
                    <NutritionRing
                      value={Math.round((stats.hunger + stats.hydration + stats.vitamins) / 3)}
                    />
                    <div className="space-y-3">
                      {(
                        [
                          ["Meals", stats.hunger],
                          ["Water", stats.hydration],
                          ["Vitamins", stats.vitamins],
                        ] as const
                      ).map(([n, v]) => (
                        <div key={n}>
                          <div className="mb-0.5 flex justify-between">
                            <span className="font-medium">{n}</span>
                            <span className="hud-muted">{Math.round(v)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/60">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${v}%`, background: "var(--gradient-lavender)" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 max-h-[40vh] space-y-3 overflow-y-auto pr-1">
                      {FOOD_CATEGORIES.map((category) => {
                        const items = data.foods.filter((food) => food.category === category);
                        if (!items.length) return null;
                        return (
                          <div key={category}>
                            <div className="mb-1 hud-label">
                              {FOOD_CATEGORY_LABELS[category as FoodCategory] ?? category}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {items.map((food) => (
                                <button
                                  key={food.key}
                                  onClick={() => act("food_eat", { food: food.key })}
                                  className="hud-food-chip"
                                >
                                  {food.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {data.currentCraving ? (
                      <div className="mt-3 rounded-2xl bg-[#F6C6D6]/25 px-3 py-3 ring-1 ring-[#D6C6E7]/60">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="hud-label">Craving right now</div>
                            <div className="hud-copy truncate font-semibold text-[#4D405E]">
                              {data.currentCraving.craving}
                            </div>
                          </div>
                          <span className="hud-muted shrink-0">
                            {data.currentCraving.intensity}% intense
                          </span>
                        </div>
                        <CloudBar value={data.currentCraving.intensity} tone="blush" />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {[
                            { key: "eat", label: "Eat it" },
                            { key: "healthy", label: "Healthy swap" },
                            { key: "ask_partner", label: "Ask partner" },
                            { key: "journal", label: "Journal it" },
                            { key: "ignore", label: "Push through" },
                          ].map((choice) => (
                            <button
                              key={choice.key}
                              type="button"
                              disabled={action.isPending}
                              onClick={() => act("craving_choice", { choice: choice.key })}
                              className="min-h-11 rounded-full bg-white/80 px-3.5 hud-copy font-semibold text-[color:var(--lavender-deep)] shadow-soft transition hover:bg-white disabled:opacity-50"
                            >
                              {choice.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-center hud-muted italic">
                        No craving right now. One will find you.
                      </p>
                    )}
                    <PrimaryButton disabled={action.isPending} onClick={() => act("craving_roll")}>
                      <span className="inline-flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> Roll a craving
                      </span>
                    </PrimaryButton>
                  </Panel>
                </AppPage>
              )}

              {active === "notifications" && (
                <AppPage title="Alerts" onBack={goBack}>
                  <Panel className="is-scroll">
                    <div className="space-y-2">
                      {data.notifications.length === 0 && (
                        <p className="text-center hud-muted italic">All quiet for now</p>
                      )}
                      {data.notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`rounded-2xl px-3 py-2 ${n.read ? "bg-white/40" : "bg-white/80 ring-1 ring-[#D6C6E7]/50"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="hud-copy min-w-0 truncate font-semibold">{n.title}</div>
                            <div className="hud-muted shrink-0 italic">
                              {new Date(n.created_at).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                          {n.body && <p className="mt-0.5 hud-muted">{n.body}</p>}
                        </div>
                      ))}
                    </div>
                    {data.unread > 0 && (
                      <PrimaryButton onClick={() => act("notifications_read")}>
                        Mark all as read
                      </PrimaryButton>
                    )}
                  </Panel>
                </AppPage>
              )}

              {active === "settings" && (
                <AppPage title="Settings" onBack={goBack}>
                  <SettingsPanel
                    key={preg.id + preg.babyGender + (preg.babyName ?? "") + preg.durationDays}
                    data={data}
                    onSave={(params) => act("settings_update", params)}
                    onAction={act}
                    pending={action.isPending}
                  />
                </AppPage>
              )}
            </main>
          </div>

          <nav className="hud-dock" aria-label="Primary">
            {DOCK_NAV.map(({ key, label, icon: Icon }) => {
              const isActive = dockKey(active) === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`hud-dock-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    backTo.current = "home";
                    setActive(key);
                  }}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </HudFrame>
      <Toaster position="top-center" />
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function SetupWizard({
  data,
  onSave,
}: {
  token: string;
  data: HudState;
  onSave: (params: Record<string, unknown>) => void;
}) {
  const hudZoom = useHudZoom();
  const [momName, setMomName] = useState(data.user.name.split(" ")[0] ?? "");
  const [week, setWeek] = useState(Math.max(1, data.pregnancy.week || 1));
  const [day, setDay] = useState(data.pregnancy.day || 0);
  const [babyCount, setBabyCount] = useState(String(data.pregnancy.babyCount || 1));
  const [babyGender, setBabyGender] = useState(data.pregnancy.babyGender || "surprise");
  const [babyName, setBabyName] = useState(data.pregnancy.babyName ?? "");
  const [privacyMode, setPrivacyMode] = useState(data.pregnancy.privacyMode || "partner");
  const [popupFrequencyMinutes, setPopupFrequencyMinutes] = useState(
    String(data.popupFrequencyMinutes || 20),
  );

  return (
    <Shell>
      <HudFrame {...hudZoom}>
        <div className="hud-main is-scroll">
          <Panel className="w-full">
            <div className="grid min-w-0 gap-4 min-[900px]:grid-cols-[0.9fr_1.1fr]">
              <div className="flex min-w-0 flex-col justify-between rounded-3xl bg-white/65 p-4">
                <div>
                  <img
                    src={logo}
                    alt="Nestoria logo"
                    width={56}
                    height={56}
                    className="h-12 w-12"
                  />
                  <h1 className="hud-brand mt-2">Welcome to Nestoria</h1>
                  <p className="mt-2 hud-muted">
                    Create the pregnancy profile that this MOAP HUD will sync with Render, Postgres,
                    and your Second Life attachment.
                  </p>
                </div>
                <div className="mt-4 rounded-2xl bg-white/70 p-3 hud-copy">
                  <div className="font-semibold">Profile Summary</div>
                  <div className="mt-2 space-y-1 hud-muted">
                    <div>Mom: {momName || "Not set"}</div>
                    <div>
                      Pregnancy: {week} weeks + {day} days
                    </div>
                    <div>
                      Baby:{" "}
                      {babyCount === "1" ? "One baby" : babyCount === "2" ? "Twins" : "Triplets"}
                    </div>
                    <div>
                      Events:{" "}
                      {popupFrequencyMinutes === "0"
                        ? "Manual only"
                        : `Every ${popupFrequencyMinutes} minutes`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <PanelHeader
                  eyebrow="First Attach Setup"
                  title="Your journey details"
                  subtitle="you can edit these later from Settings"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Mom name</Label>
                    <Input
                      value={momName}
                      onChange={(e) => setMomName(e.target.value)}
                      placeholder="Zoedollyanna"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Baby name or nickname</Label>
                    <Input
                      value={babyName}
                      onChange={(e) => setBabyName(e.target.value)}
                      placeholder="Decide later"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Week</Label>
                    <Input
                      type="number"
                      min={1}
                      max={40}
                      value={week}
                      onChange={(e) => setWeek(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Day</Label>
                    <Input
                      type="number"
                      min={0}
                      max={6}
                      value={day}
                      onChange={(e) => setDay(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Baby count</Label>
                    <Select value={babyCount} onValueChange={setBabyCount}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">One baby</SelectItem>
                        <SelectItem value="2">Twins</SelectItem>
                        <SelectItem value="3">Triplets</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gender</Label>
                    <Select value={babyGender} onValueChange={setBabyGender}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="girl">Girl</SelectItem>
                        <SelectItem value="boy">Boy</SelectItem>
                        <SelectItem value="twins">Twins mixed</SelectItem>
                        <SelectItem value="surprise">Surprise later</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Privacy</Label>
                    <Select value={privacyMode} onValueChange={setPrivacyMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Only me</SelectItem>
                        <SelectItem value="partner">Partner only</SelectItem>
                        <SelectItem value="partner_doctor">Partner + doctor</SelectItem>
                        <SelectItem value="public_rp">Public RP emotes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>RP event popups</Label>
                    <p className="hud-muted">
                      Mood swings use this timer too. Meters nudge which feeling is more likely.
                    </p>
                    <Select value={popupFrequencyMinutes} onValueChange={setPopupFrequencyMinutes}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="20">Every 20 minutes</SelectItem>
                        <SelectItem value="30">Every 30 minutes</SelectItem>
                        <SelectItem value="60">Every hour</SelectItem>
                        <SelectItem value="0">Only manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <PrimaryButton
                  onClick={() =>
                    onSave({
                      momName,
                      week,
                      day,
                      babyCount: Number(babyCount),
                      babyGender,
                      babyNames: babyName.trim() ? [babyName.trim()] : [],
                      privacyMode,
                      popupFrequencyMinutes: Number(popupFrequencyMinutes),
                    })
                  }
                >
                  Confirm profile
                </PrimaryButton>
              </div>
            </div>
          </Panel>
        </div>
      </HudFrame>
      <Toaster position="top-center" />
    </Shell>
  );
}

/**
 * The RP moment card.
 *
 * This and the in-world blue menu are two views of one database row, so the
 * buttons here are the same buttons the dialog shows — whatever *this* event
 * actually offers, not a fixed list — and answering on either surface closes
 * the other. She can also let it pass: an ignored moment is a real choice, and
 * an unanswered one lapses on its own after a few minutes rather than blocking
 * the next one forever.
 */
function EventCard({
  event,
  pending,
  onChoose,
  onDismiss,
}: {
  event: NonNullable<HudState["activeEvent"]>;
  pending: boolean;
  onChoose: (choice: string) => void;
  onDismiss: () => void;
}) {
  return (
    <section className="shrink-0" aria-live="polite">
      <div className="rounded-2xl bg-white/85 px-3 py-2.5 shadow-soft ring-1 ring-[#D6C6E7]/60">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="hud-label">A moment</div>
            <div className="hud-copy font-semibold text-[#4D405E]">{event.title}</div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={pending}
            className="hud-muted shrink-0 underline disabled:opacity-50"
          >
            Let it pass
          </button>
        </div>
        {event.body && <p className="mb-2 hud-muted italic">{event.body}</p>}
        <div className="flex flex-wrap gap-1.5">
          {event.choices.map((choice) => (
            <button
              key={choice.key}
              type="button"
              disabled={pending}
              onClick={() => onChoose(choice.key)}
              title={choice.label}
              className="min-h-11 rounded-full bg-white/80 px-3.5 hud-copy font-semibold text-[color:var(--lavender-deep)] shadow-soft transition hover:bg-white disabled:opacity-50"
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 group">
      <div className="h-12 w-12 rounded-2xl bg-white/80 shadow-soft flex items-center justify-center group-hover:scale-105 group-hover:bg-white transition-transform">
        <Icon className="h-5 w-5 text-[color:var(--lavender-deep)]" />
      </div>
      <span className="hud-subtitle">{label}</span>
    </button>
  );
}

function NutritionRing({ value }: { value: number }) {
  return (
    <div className="flex flex-col items-center mb-4">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="oklch(0.94 0.02 305)"
            strokeWidth="10"
            fill="none"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="oklch(0.72 0.12 300)"
            strokeWidth="10"
            fill="none"
            strokeDasharray={`${(value / 100) * 264} 264`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-2xl font-semibold text-[color:var(--lavender-deep)]">
            {value}%
          </div>
          <div className="hud-subtitle uppercase tracking-widest">
            {value >= 70 ? "Good" : value >= 40 ? "Okay" : "Low"}
          </div>
        </div>
      </div>
    </div>
  );
}

function PairingCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="mx-auto flex items-center gap-3 rounded-2xl bg-white/80 px-6 py-4 shadow-soft hover:bg-white transition"
    >
      <span className="font-display text-3xl font-semibold tracking-[0.3em] text-[color:var(--lavender-deep)]">
        {code}
      </span>
      {copied ? (
        <Check className="h-4 w-4 text-[color:var(--lavender-deep)]" />
      ) : (
        <Copy className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

function TimelineDialog({ currentWeek }: { currentWeek: number }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="mt-6 w-full rounded-full py-3 font-medium text-white shadow-soft transition hover:brightness-105"
          style={{ background: "var(--gradient-lavender)" }}
        >
          View Pregnancy Timeline
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[color:var(--lavender-deep)]">
            Your pregnancy timeline
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {BABY_GROWTH.map((m) => {
            const current =
              m.week <= currentWeek &&
              (BABY_GROWTH.find((x) => x.week > m.week)?.week ?? 99) > currentWeek;
            return (
              <div
                key={m.week}
                className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 ${current ? "bg-[color:var(--lavender)]/25 ring-1 ring-[color:var(--lavender)]" : m.week <= currentWeek ? "bg-white/70" : "bg-white/30 opacity-60"}`}
              >
                <div className="w-14 shrink-0 text-center">
                  <div className="font-display text-lg font-semibold text-[color:var(--lavender-deep)]">
                    W{m.week}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{m.size}</div>
                  <div className="text-xs text-muted-foreground">{m.note}</div>
                </div>
                {m.week <= currentWeek && (
                  <Check className="h-4 w-4 shrink-0 text-[color:var(--lavender-deep)]" />
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JournalDialog({
  token,
  onSave,
}: {
  token: string;
  onSave: (entry: {
    title: string;
    body: string;
    kind: string;
    photoId?: string;
    photoUrl?: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("note");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setBody("");
    setKind("note");
    setPhotoFile(null);
    setPreview(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button className="mt-4 w-full rounded-full py-2.5 text-sm font-medium text-[color:var(--lavender-deep)] bg-white/70 hover:bg-white transition flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" /> New Journal Entry
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[color:var(--lavender-deep)]">
            New journal entry
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="j-title">Title</Label>
            <Input
              id="j-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="First baby kick!"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="milestone">Milestone</SelectItem>
                <SelectItem value="memory">Memory</SelectItem>
                <SelectItem value="appointment">Appointment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="j-body">Details</Label>
            <Textarea
              id="j-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write it down before it fades…"
              rows={4}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="j-photo">Photo from your PC</Label>
            <Input
              id="j-photo"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setPhotoFile(file);
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
            {preview && (
              <img src={preview} alt="" className="mt-2 max-h-36 w-full rounded-2xl object-cover" />
            )}
            <p className="hud-muted">
              Pick a picture on this computer. Second Life media can upload it from here.
            </p>
          </div>
        </div>
        <DialogFooter>
          <button
            disabled={saving}
            onClick={() => {
              if (!title.trim()) {
                toast.error("Give your entry a title ♥");
                return;
              }
              void (async () => {
                setSaving(true);
                try {
                  let photoId: string | undefined;
                  if (photoFile) {
                    const uploaded = await uploadJournalPhoto(token, photoFile);
                    photoId = uploaded.id;
                  }
                  onSave({ title, body, kind, photoId });
                  reset();
                  setOpen(false);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not save that photo");
                } finally {
                  setSaving(false);
                }
              })();
            }}
            className="w-full rounded-full py-2.5 font-medium text-white shadow-soft transition hover:brightness-105 disabled:opacity-60"
            style={{ background: "var(--gradient-lavender)" }}
          >
            {saving ? "Saving…" : "Save entry"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemoryDialog({ onSave }: { onSave: (entry: { title: string; body: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex flex-col items-center gap-1.5 group">
          <div className="h-12 w-12 rounded-2xl bg-white/80 shadow-soft flex items-center justify-center group-hover:scale-105 group-hover:bg-white transition-transform">
            <Camera className="h-5 w-5 text-[color:var(--lavender-deep)]" />
          </div>
          <span className="hud-subtitle">Memory</span>
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[color:var(--lavender-deep)]">
            Capture a memory
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What happened?"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="A few words to remember it by…"
            rows={3}
          />
        </div>
        <DialogFooter>
          <button
            onClick={() => {
              if (!title.trim()) {
                toast.error("Give your memory a title ♥");
                return;
              }
              onSave({ title, body });
              setTitle("");
              setBody("");
              setOpen(false);
            }}
            className="w-full rounded-full py-2.5 font-medium text-white shadow-soft transition hover:brightness-105"
            style={{ background: "var(--gradient-lavender)" }}
          >
            Save memory 📸
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventDialog({ onSave }: { onSave: (entry: { title: string; body: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex flex-col items-center gap-1.5 group">
          <div className="h-12 w-12 rounded-2xl bg-white/80 shadow-soft flex items-center justify-center group-hover:scale-105 group-hover:bg-white transition-transform">
            <Calendar className="h-5 w-5 text-[color:var(--lavender-deep)]" />
          </div>
          <span className="hud-subtitle">Event</span>
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[color:var(--lavender-deep)]">
            Plan an event
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Baby shower, gender reveal…"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="When and where?"
            rows={3}
          />
        </div>
        <DialogFooter>
          <button
            onClick={() => {
              if (!title.trim()) {
                toast.error("Name your event ♥");
                return;
              }
              onSave({ title, body });
              setTitle("");
              setBody("");
              setOpen(false);
            }}
            className="w-full rounded-full py-2.5 font-medium text-white shadow-soft transition hover:brightness-105"
            style={{ background: "var(--gradient-lavender)" }}
          >
            Add event 📅
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SymptomsDialog({
  symptoms,
  onSave,
}: {
  symptoms: { name: string; severity: number }[];
  onSave: (name: string, severity: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, number>>({});
  const current = (name: string, fallback: number) => values[name] ?? fallback;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValues({});
      }}
    >
      <DialogTrigger asChild>
        <button className="mt-5 w-full rounded-full py-2.5 text-sm font-medium text-[color:var(--lavender-deep)] bg-white/70 hover:bg-white transition">
          Update symptoms
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[color:var(--lavender-deep)]">
            How are you feeling?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {symptoms.map((s) => (
            <div key={s.name} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">{current(s.name, s.severity)}%</span>
              </div>
              <Slider
                value={[current(s.name, s.severity)]}
                max={100}
                step={5}
                onValueChange={([v]) => setValues((prev) => ({ ...prev, [s.name]: v }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <button
            onClick={() => {
              const changed = Object.entries(values);
              if (!changed.length) {
                setOpen(false);
                return;
              }
              for (const [name, severity] of changed) onSave(name, severity);
              setOpen(false);
            }}
            className="w-full rounded-full py-2.5 font-medium text-white shadow-soft transition hover:brightness-105"
            style={{ background: "var(--gradient-lavender)" }}
          >
            Save changes
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SettingsTab = "journey" | "events" | "sound" | "privacy" | "realism";

const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: "journey", label: "Journey" },
  { key: "events", label: "Events" },
  { key: "sound", label: "Sound" },
  { key: "privacy", label: "Privacy" },
  { key: "realism", label: "Realism" },
];

/** A labelled on/off row. Used everywhere in the preferences hub. */
function PrefToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2">
      <span className="min-w-0">
        <span className="hud-copy block font-semibold">{label}</span>
        {hint && <span className="hud-muted block">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function PrefSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="hud-label mb-1">{title}</div>
      {hint && <p className="hud-muted mb-2">{hint}</p>}
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function SettingsPanel({
  data,
  onSave,
  onAction,
  pending,
}: {
  data: HudState;
  onSave: (params: Record<string, unknown>) => void;
  onAction: (name: string, params?: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [tab, setTab] = useState<SettingsTab>("journey");

  // Journey fields
  const [babyName, setBabyName] = useState(data.pregnancy.babyName ?? "");
  const [babyGender, setBabyGender] = useState(data.pregnancy.babyGender);
  const [durationDays, setDurationDays] = useState(String(data.pregnancy.durationDays));

  // Preferences are edited locally and saved per tab, so a slow connection
  // never fights the wearer mid-toggle.
  const [prefs, setPrefs] = useState<HudPreferences>(() =>
    normalizePreferences(data.preferences ?? {}),
  );
  const serverPrefs = data.preferences;
  useEffect(() => {
    setPrefs(normalizePreferences(serverPrefs ?? {}));
  }, [serverPrefs]);

  const set = <K extends keyof HudPreferences>(key: K, value: HudPreferences[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const savePrefs = (patch: Partial<HudPreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    onSave({ preferences: next });
  };

  return (
    <section className="min-w-0">
      <Panel className="is-scroll">
        <PanelHeader eyebrow="Settings" title="Your journey, your way" />

        <div className="mb-3 flex flex-wrap gap-1.5">
          {SETTINGS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`min-h-9 rounded-full px-3 hud-copy font-semibold transition ${
                tab === t.key
                  ? "bg-[#A77ACB] text-white shadow-soft"
                  : "bg-white/70 text-[color:var(--lavender-deep)] hover:bg-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ---------------- Journey ---------------- */}
        {tab === "journey" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Baby name</Label>
              <Input
                id="s-name"
                value={babyName}
                onChange={(e) => setBabyName(e.target.value)}
                placeholder="Still deciding…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>We're expecting…</Label>
              <Select value={babyGender} onValueChange={setBabyGender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="surprise">It's a surprise ✨</SelectItem>
                  <SelectItem value="girl">A little girl 🎀</SelectItem>
                  <SelectItem value="boy">A little boy 💙</SelectItem>
                  <SelectItem value="twins">Twins!</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-days">Pregnancy length (real days, 1–280)</Label>
              <Input
                id="s-days"
                type="number"
                min={1}
                max={280}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
              />
              <p className="hud-muted">
                How many real-life days the full 40 weeks take. Most Second Life pregnancies run
                14–45 days. Changing this keeps you at the same week.
              </p>
            </div>
            <PrimaryButton
              disabled={pending}
              onClick={() => onSave({ babyName, babyGender, durationDays: Number(durationDays) })}
            >
              Save journey
            </PrimaryButton>
          </div>
        )}

        {/* ---------------- Events & popups ---------------- */}
        {tab === "events" && (
          <div>
            <PrefSection
              title="How often"
              hint="RP moments arrive on this timer. Answering one restarts it."
            >
              <Select
                value={String(prefs.popupFrequencyMinutes)}
                onValueChange={(v) => savePrefs({ popupFrequencyMinutes: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POPUP_FREQUENCIES.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m === 0 ? "Never — only when I ask" : `Every ${m} minutes`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PrefSection>

            <PrefSection title="Where they appear">
              <Select
                value={prefs.popupSurface}
                onValueChange={(v) =>
                  savePrefs({ popupSurface: v as HudPreferences["popupSurface"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POPUP_SURFACES.map((sfc) => (
                    <SelectItem key={sfc.key} value={sfc.key}>
                      {sfc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="hud-muted px-1">
                {POPUP_SURFACES.find((sfc) => sfc.key === prefs.popupSurface)?.hint}
              </p>
            </PrefSection>

            <PrefSection
              title="What can happen"
              hint="Switch off anything you don't want to roleplay. Nothing from a switched-off group will ever interrupt you."
            >
              {EVENT_CATEGORIES.map((cat) => (
                <PrefToggle
                  key={cat}
                  label={EVENT_CATEGORY_LABELS[cat]}
                  hint={EVENT_CATEGORY_HINTS[cat]}
                  checked={prefs.eventCategories[cat]}
                  onChange={(next) =>
                    savePrefs({
                      eventCategories: { ...prefs.eventCategories, [cat]: next },
                    })
                  }
                />
              ))}
            </PrefSection>

            <button
              type="button"
              disabled={pending}
              onClick={() => onAction("random_event_roll")}
              className="min-h-12 w-full rounded-full bg-white/70 hud-copy font-semibold text-[#A77ACB] disabled:opacity-60"
            >
              Give me a moment now
            </button>
          </div>
        )}

        {/* ---------------- Sound & animation ---------------- */}
        {tab === "sound" && (
          <div>
            <PrefSection
              title="Sound"
              hint="The dashboard makes its own sounds through the HUD screen, so these are what you hear in Second Life."
            >
              <PrefToggle
                label="HUD sounds"
                hint="Chimes, heartbeats, water, kicks."
                checked={prefs.soundEnabled}
                onChange={(next) => savePrefs({ soundEnabled: next })}
              />
              <div className="rounded-2xl bg-white/70 px-3 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="hud-copy font-semibold">Volume</span>
                  <span className="hud-muted">{prefs.soundVolume}%</span>
                </div>
                <Slider
                  value={[prefs.soundVolume]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => set("soundVolume", v)}
                  onValueCommit={([v]) => savePrefs({ soundVolume: v })}
                />
              </div>
            </PrefSection>

            <PrefSection
              title="In-world animations"
              hint="Each of these plays on your avatar or rezzes a prop. Switch off anything you'd rather emote yourself."
            >
              {ANIMATION_KEYS.map((key) => (
                <PrefToggle
                  key={key}
                  label={ANIMATION_LABELS[key]}
                  checked={prefs.animations[key]}
                  onChange={(next) =>
                    savePrefs({ animations: { ...prefs.animations, [key]: next } })
                  }
                />
              ))}
            </PrefSection>
          </div>
        )}

        {/* ---------------- Privacy & partner ---------------- */}
        {tab === "privacy" && (
          <div>
            <PrefSection title="Who can see your journey">
              <Select
                value={prefs.privacyMode}
                onValueChange={(v) =>
                  savePrefs({ privacyMode: v as HudPreferences["privacyMode"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIVACY_MODES.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="hud-muted px-1">
                {PRIVACY_MODES.find((m) => m.key === prefs.privacyMode)?.hint}
              </p>
              <PrefToggle
                label="Public RP emotes"
                hint="Let nearby roleplayers see emotes from your HUD in local chat."
                checked={prefs.publicEmotes}
                onChange={(next) => savePrefs({ publicEmotes: next })}
              />
            </PrefSection>

            <PrefSection
              title="What reaches your partner"
              hint={
                data.partner.linked
                  ? `${data.partner.name ?? "Your partner"} is notified about these. Everything else stays yours.`
                  : "These apply as soon as a partner is linked."
              }
            >
              {PARTNER_NOTIFY_KEYS.map((key) => (
                <PrefToggle
                  key={key}
                  label={PARTNER_NOTIFY_LABELS[key]}
                  checked={prefs.partnerNotify[key]}
                  onChange={(next) =>
                    savePrefs({ partnerNotify: { ...prefs.partnerNotify, [key]: next } })
                  }
                />
              ))}
            </PrefSection>

            <p className="hud-muted px-1">
              Consent for individual partner actions — hugs, back rubs, ice chips — lives on the
              Partner tab, under Privacy.
            </p>
          </div>
        )}

        {/* ---------------- Realism & pacing ---------------- */}
        {tab === "realism" && (
          <div>
            <PrefSection
              title="How fast your meters move"
              hint="This changes how often you need to eat, drink, rest and take vitamins."
            >
              <Select
                value={prefs.decayPace}
                onValueChange={(v) => savePrefs({ decayPace: v as HudPreferences["decayPace"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECAY_PACES.map((pace) => (
                    <SelectItem key={pace.key} value={pace.key}>
                      {pace.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="hud-muted px-1">
                {DECAY_PACES.find((pace) => pace.key === prefs.decayPace)?.hint}
              </p>
            </PrefSection>

            <PrefSection title="Content">
              <PrefToggle
                label="Pica cravings"
                hint="Corn starch and chalk. Realistic, and not for everyone."
                checked={prefs.allowPica}
                onChange={(next) => savePrefs({ allowPica: next })}
              />
            </PrefSection>

            <TestModePanel data={data} onAction={onAction} pending={pending} />
          </div>
        )}
      </Panel>
    </section>
  );
}

/**
 * Labor test tools.
 *
 * Hidden behind a code so a real player never trips over them: labor is meant
 * to arrive on its own, and a visible "start labor" button would undo the whole
 * point of the engine. Unlocking is server-checked, not just hidden in the UI —
 * every test action re-verifies that this pregnancy is in test mode.
 */
function TestModePanel({
  data,
  onAction,
  pending,
}: {
  data: HudState;
  onAction: (name: string, params?: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [code, setCode] = useState("");
  const [week, setWeek] = useState(String(Math.max(1, data.pregnancy.week)));
  const unlocked = data.testMode;

  if (!unlocked) {
    return (
      <div className="mt-4 rounded-2xl bg-white/50 px-3 py-3">
        <div className="hud-label mb-1">Testing</div>
        <p className="hud-muted mb-2">
          Have a code from the creator? Enter it to unlock the labor test tools.
        </p>
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code"
            aria-label="Test mode code"
          />
          <button
            type="button"
            disabled={pending || !code.trim()}
            onClick={() => onAction("test_unlock", { code: code.trim() })}
            className="min-h-11 shrink-0 rounded-full bg-white/80 px-4 hud-copy font-semibold text-[#A77ACB] disabled:opacity-50"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl bg-[#F6C6D6]/25 px-3 py-3 ring-1 ring-[#A77ACB]/30">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="hud-label">Test mode — on</div>
        <button
          type="button"
          disabled={pending}
          onClick={() => onAction("test_lock")}
          className="hud-muted underline"
        >
          Turn off &amp; restore
        </button>
      </div>
      <p className="hud-muted mb-3">
        These rewrite the labor plan for testing. Turning test mode off puts the real timing back.
      </p>

      <div className="mb-3 space-y-1.5">
        <Label htmlFor="t-week">Jump to week</Label>
        <div className="flex gap-2">
          <Input
            id="t-week"
            type="number"
            min={1}
            max={42}
            value={week}
            onChange={(e) => setWeek(e.target.value)}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => onAction("test_jump_week", { week: Number(week), day: 0 })}
            className="min-h-11 shrink-0 rounded-full bg-white/80 px-4 hud-copy font-semibold text-[#A77ACB] disabled:opacity-50"
          >
            Jump
          </button>
        </div>
      </div>

      <div className="mb-3 space-y-1.5">
        <Label>Labor speed</Label>
        <div className="flex flex-wrap gap-1.5">
          {TEST_LABOR_SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              disabled={pending}
              onClick={() => onAction("test_labor_speed", { speed })}
              className="min-h-10 rounded-full bg-white/80 px-3 hud-copy font-semibold text-[#A77ACB] disabled:opacity-50"
            >
              {speed}×
            </button>
          ))}
        </div>
        <p className="hud-muted">
          25× turns a three-hour labor into about seven minutes — enough to run the whole
          contractions → water → hospital → birth sequence with a partner in one sitting.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onAction("test_force_labor")}
          className="min-h-11 flex-1 rounded-full bg-[#A77ACB] px-4 hud-copy font-semibold text-white disabled:opacity-50"
        >
          Start labor now
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onAction("test_reset_labor")}
          className="min-h-11 flex-1 rounded-full bg-white/80 px-4 hud-copy font-semibold text-[#A77ACB] disabled:opacity-50"
        >
          Reset labor
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ultrasound scrapbook
// ---------------------------------------------------------------------------

interface UltrasoundPhoto {
  index: number;
  week: number;
  seen: boolean;
  unlockedAt: string;
  url: string;
}

function ScrapbookDialog({
  ultrasounds,
  newCount,
  babyName,
  onOpened,
}: {
  ultrasounds: UltrasoundPhoto[];
  newCount: number;
  babyName: string | null;
  onOpened: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const photos = ultrasounds;
  const current = photos[page];

  const openChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      setPage(Math.max(0, photos.length - 1)); // newest scan first
      onOpened();
    }
  };

  const tape = (extra: string) => (
    <span
      className={`pointer-events-none absolute h-6 w-16 rounded-sm opacity-80 ${extra}`}
      style={{
        background:
          "linear-gradient(135deg, oklch(0.88 0.07 355 / 0.85), oklch(0.85 0.08 300 / 0.85))",
      }}
    />
  );

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>
        <button className="relative mt-2.5 w-full rounded-full py-2.5 text-sm font-medium text-[color:var(--lavender-deep)] bg-white/70 hover:bg-white transition flex items-center justify-center gap-2">
          <Camera className="h-4 w-4" /> Baby's scrapbook
          {newCount > 0 && (
            <span className="absolute -top-1.5 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[color:var(--blush)] px-1.5 text-xs font-bold text-white shadow-soft">
              {newCount} new
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-w-xl rounded-[28px]"
        style={{
          background: "linear-gradient(160deg, oklch(0.97 0.03 80) 0%, oklch(0.95 0.03 320) 100%)",
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-center">
            <span className="font-script text-3xl text-[color:var(--lavender-deep)]">
              {babyName ? `${babyName}'s scrapbook` : "Baby's first scrapbook"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {photos.length === 0 ? (
          <div className="py-10 text-center">
            <Camera className="mx-auto h-10 w-10 text-[color:var(--lavender)]" />
            <p className="mt-4 font-display text-xl text-[color:var(--lavender-deep)]">
              No scans yet
            </p>
            <p className="mt-1 text-sm italic text-muted-foreground">
              Your first ultrasound arrives around week 6 — we'll let you know the moment it's ready
              ♥
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Polaroid */}
            <div className="relative mx-auto my-3 w-full max-w-sm">
              <div
                className="relative rounded-md bg-white p-3 pb-12 shadow-cloud transition-transform duration-500"
                style={{ transform: `rotate(${current.index % 2 === 0 ? 1.6 : -1.8}deg)` }}
              >
                {tape("-top-3 left-6 -rotate-6")}
                {tape("-top-3 right-6 rotate-6")}
                <img
                  src={current.url}
                  alt={`Week ${current.week} ultrasound`}
                  className="aspect-[4/3] w-full rounded-sm object-cover"
                />
                {!current.seen && (
                  <span className="absolute right-4 top-4 rounded-full bg-[color:var(--blush)] px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-white shadow-soft">
                    New
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-2.5 text-center">
                  <span className="font-script text-xl text-[color:var(--lavender-deep)]">
                    Week {current.week} ♥{" "}
                    <span className="text-sm text-muted-foreground">
                      {new Date(current.unlockedAt).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-1 flex items-center gap-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Previous scan"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-soft transition hover:bg-white disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4 text-[color:var(--lavender-deep)]" />
              </button>
              <div className="flex items-center gap-1.5">
                {photos.map((p, i) => (
                  <button
                    key={p.index}
                    onClick={() => setPage(i)}
                    aria-label={`Scan ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${i === page ? "w-5 bg-[color:var(--lavender-deep)]" : "w-2 bg-[color:var(--lavender)]/50 hover:bg-[color:var(--lavender)]"}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(photos.length - 1, p + 1))}
                disabled={page >= photos.length - 1}
                aria-label="Next scan"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-soft transition hover:bg-white disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4 text-[color:var(--lavender-deep)]" />
              </button>
            </div>

            <p className="mt-3 text-xs italic text-muted-foreground">
              {photos.length} of 10 little moments collected <Sparkles className="inline h-3 w-3" />
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
