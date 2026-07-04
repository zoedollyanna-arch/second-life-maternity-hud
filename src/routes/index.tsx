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
  Activity,
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
  ZoomIn,
  ZoomOut,
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
import { useHudState, useHudAction, type HudState, type HudStats } from "@/lib/hud-api";
import { BABY_GROWTH } from "@/lib/pregnancy";
import { playForAction, playChime, playError, playHearts } from "@/lib/sounds";

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
  | "journal"
  | "nutrition"
  | "notifications"
  | "settings";

const NAV: { key: NavKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "pregnancy", label: "Pregnancy", icon: Sparkles },
  { key: "health", label: "Health", icon: Heart },
  { key: "baby", label: "Baby", icon: Baby },
  { key: "care", label: "Care & Comfort", icon: Moon },
  { key: "partner", label: "Partner", icon: Users },
  { key: "journal", label: "Journal", icon: BookHeart },
  { key: "nutrition", label: "Nutrition", icon: Apple },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "settings", label: "Settings", icon: Settings },
];

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
// Shared visual primitives (unchanged design language)
// ---------------------------------------------------------------------------

function CloudBar({
  value,
  tone = "lavender",
}: {
  value: number;
  tone?: "lavender" | "blush" | "cream";
}) {
  const gradient =
    tone === "blush"
      ? "linear-gradient(90deg, oklch(0.82 0.1 355) 0%, oklch(0.88 0.08 355) 60%, oklch(0.95 0.02 355) 100%)"
      : tone === "cream"
        ? "linear-gradient(90deg, oklch(0.88 0.08 80) 0%, oklch(0.94 0.05 80) 60%, oklch(0.97 0.02 80) 100%)"
        : "linear-gradient(90deg, oklch(0.72 0.12 300) 0%, oklch(0.82 0.09 305) 55%, oklch(0.94 0.03 305) 100%)";
  return (
    <div
      className="relative h-6 w-full rounded-full overflow-hidden"
      style={{
        background: "oklch(0.96 0.012 305)",
        boxShadow: "inset 0 2px 4px oklch(0.55 0.15 300 / 0.15)",
      }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: gradient }}
      >
        <div className="absolute inset-0 animate-[meterSheen_2.8s_linear_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)]" />
        <div className="absolute inset-0 flex items-center gap-1 px-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="h-3 w-3 rounded-full bg-white/60 blur-[1px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Meter({
  icon: Icon,
  label,
  value,
  tone = "lavender",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "lavender" | "blush" | "cream";
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 shadow-soft">
        <Icon className="h-4 w-4 text-[color:var(--lavender-deep)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
          <span className="text-xs font-semibold text-[color:var(--lavender-deep)]">
            {Math.round(value)}%
          </span>
        </div>
        <CloudBar value={value} tone={tone} />
      </div>
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[20px] bg-card/85 backdrop-blur-xl shadow-cloud ring-1 ring-white/60 p-4 lg:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function PanelHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 text-center">
      {eyebrow && (
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--lavender-deep)]/70">
          {eyebrow}
        </div>
      )}
      <h2 className="mt-1 text-2xl font-display font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="text-xs italic text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-5 w-full rounded-full py-2.5 font-medium text-white shadow-soft transition hover:brightness-105 disabled:opacity-60"
      style={{ background: "var(--gradient-lavender)" }}
    >
      {children}
    </button>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2">
      <span className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function Ambient() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white/70"
            style={{
              top: `${(i * 37) % 100}%`,
              left: `${(i * 53) % 100}%`,
              boxShadow: "0 0 8px 2px oklch(0.9 0.05 300 / 0.6)",
              animation: `twinkle ${3 + (i % 4)}s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`@keyframes twinkle { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1.3)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes meterSheen { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }`}</style>
    </>
  );
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

function Index() {
  const { token } = Route.useSearch();
  const state = useHudState(token ?? null);

  if (!token) return <ConnectScreen />;
  if (state.isLoading) {
    return (
      <Shell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-[color:var(--lavender-deep)]" />
            <p className="mt-4 font-display text-xl text-[color:var(--lavender-deep)]">
              Opening your nursery…
            </p>
          </div>
        </div>
      </Shell>
    );
  }
  if (state.isError || !state.data || state.data.error) {
    return (
      <Shell>
        <div className="flex min-h-[60vh] items-center justify-center px-6">
          <Panel className="max-w-md text-center">
            <PanelHeader eyebrow="Session" title="Your session has expired" />
            <p className="text-sm text-muted-foreground">
              Touch your Nestoria HUD in Second Life and choose <b>Sync</b> — it will refresh this
              screen with a new session.
            </p>
          </Panel>
        </div>
      </Shell>
    );
  }
  return <Dashboard token={token} data={state.data} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full">
      <Ambient />
      {children}
    </div>
  );
}

function ConnectScreen() {
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
      <div className="flex min-h-screen items-center justify-center px-6">
        <Panel className="max-w-lg text-center">
          <img
            src={logo}
            alt="Nestoria logo"
            width={96}
            height={96}
            className="mx-auto h-20 w-20"
            style={{ animation: "float 5s ease-in-out infinite" }}
          />
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-wide text-[color:var(--lavender-deep)]">
            NESTORIA
          </h1>
          <p className="font-script text-lg text-[color:var(--lavender-deep)]/70">
            where every family journey begins
          </p>
          <div className="mt-6 space-y-3 text-left text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">To open your dashboard:</p>
            <p>
              1. Wear the <b>Nestoria HUD</b> in Second Life.
            </p>
            <p>2. It registers automatically and loads this dashboard on its screen.</p>
            <p>
              3. Make sure media is enabled: <i>Preferences → Sound &amp; Media → Media</i>.
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
      <Toaster position="top-center" />
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function Dashboard({ token, data }: { token: string; data: HudState }) {
  const [active, setActive] = useState<NavKey>("home");
  const [uiScale, setUiScale] = useState(() => {
    if (typeof window === "undefined") return 0.9;
    const saved = Number(window.localStorage.getItem("nestoriaHudScale") ?? 0.9);
    return Number.isFinite(saved) ? Math.max(0.75, Math.min(1.15, saved)) : 0.9;
  });
  const action = useHudAction(token);

  const setZoom = (next: number) => {
    const clamped = Math.max(0.75, Math.min(1.15, Number(next.toFixed(2))));
    setUiScale(clamped);
    if (typeof window !== "undefined") window.localStorage.setItem("nestoriaHudScale", String(clamped));
  };

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

  // Chime when new notifications arrive (heard in SL through the media screen)
  const unreadRef = useRef(data.unread);
  useEffect(() => {
    if (data.unread > unreadRef.current) playChime();
    unreadRef.current = data.unread;
  }, [data.unread]);

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
  const show = (...keys: NavKey[]) => active === "home" || keys.includes(active);

  const dueDate = useMemo(
    () =>
      new Date(preg.dueDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [preg.dueDate],
  );
  const firstName = data.user.name.split(" ")[0];
  if (!preg.setupComplete && data.user.role === "mom") {
    return (
      <SetupWizard token={token} data={data} onSave={(params) => act("setup_update", params)} />
    );
  }

  return (
    <Shell>
      <div
        className="origin-top"
        style={{
          transform: `scale(${uiScale})`,
          width: `${100 / uiScale}%`,
        }}
      >
      {/* Header */}
      <header className="relative z-10 mx-auto max-w-[1320px] px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src={logo}
              alt="Nestoria logo"
              width={72}
              height={72}
              className="h-12 w-12 drop-shadow-[0_4px_12px_oklch(0.55_0.15_300/0.25)]"
              style={{ animation: "float 5s ease-in-out infinite" }}
            />
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-wide text-[color:var(--lavender-deep)]">
                NESTORIA
              </h1>
              <p className="font-script text-sm text-[color:var(--lavender-deep)]/70">
                where every family journey begins
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 rounded-full bg-card/80 backdrop-blur-md px-3 py-2 shadow-soft">
            <div className="h-10 w-10 rounded-full bg-[color:var(--lavender)] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Welcome back
              </div>
              <div className="font-display text-lg leading-none">
                {firstName} <span className="text-[color:var(--blush)]">♥</span>
              </div>
            </div>
            <div className="ml-3 flex gap-2">
              <button
                onClick={() => setZoom(uiScale - 0.05)}
                aria-label="Zoom out"
                title="Zoom out"
                className="h-10 w-10 rounded-full bg-white/70 flex items-center justify-center shadow-soft hover:bg-white transition"
              >
                <ZoomOut className="h-4 w-4 text-[color:var(--lavender-deep)]" />
              </button>
              <button
                onClick={() => setZoom(uiScale + 0.05)}
                aria-label="Zoom in"
                title="Zoom in"
                className="h-10 w-10 rounded-full bg-white/70 flex items-center justify-center shadow-soft hover:bg-white transition"
              >
                <ZoomIn className="h-4 w-4 text-[color:var(--lavender-deep)]" />
              </button>
              <button
                onClick={() => setActive("notifications")}
                aria-label="Notifications"
                className="relative h-10 w-10 rounded-full bg-white/70 flex items-center justify-center shadow-soft hover:bg-white transition"
              >
                <Bell className="h-4 w-4 text-[color:var(--lavender-deep)]" />
                {data.unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[color:var(--blush)] text-[9px] font-bold text-white flex items-center justify-center">
                    {data.unread}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActive("settings")}
                aria-label="Settings"
                className="h-10 w-10 rounded-full bg-white/70 flex items-center justify-center shadow-soft hover:bg-white transition"
              >
                <Settings className="h-4 w-4 text-[color:var(--lavender-deep)]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1320px] px-4 pb-20">
        {preg.delivered && (
          <div className="mb-6 rounded-[28px] bg-card/90 p-5 text-center shadow-cloud ring-1 ring-white/60">
            <span className="font-display text-2xl text-[color:var(--lavender-deep)]">
              🎉 Your little one has arrived! Congratulations
              {preg.babyName ? ` on ${preg.babyName}` : ""} ♥
            </span>
          </div>
        )}
        <div className="grid grid-cols-12 gap-4">
          {/* Sidebar */}
          <aside className="col-span-12 md:col-span-3 lg:col-span-2">
            <Panel className="p-2">
              <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
                {NAV.map(({ key, label, icon: Icon }) => {
                  const isActive = active === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActive(key)}
                      className={`group flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                        isActive
                          ? "bg-[color:var(--lavender)] text-white shadow-soft"
                          : "text-muted-foreground hover:bg-white/70 hover:text-[color:var(--lavender-deep)]"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                      {key === "notifications" && data.unread > 0 && (
                        <span className="h-4 min-w-4 rounded-full bg-[color:var(--blush)] px-1 text-[9px] font-bold text-white flex items-center justify-center">
                          {data.unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </Panel>
          </aside>

          {/* Pregnancy hero */}
          {show("pregnancy") && (
            <section className="col-span-12 md:col-span-9 lg:col-span-6">
              <Panel className="relative overflow-hidden">
                <PanelHeader
                  eyebrow="Pregnancy"
                  title="Your beautiful journey"
                  subtitle="every day is a step closer to meeting your little one"
                />
                <div className="grid grid-cols-2 gap-6 items-center">
                  <div className="relative">
                    <div
                      className="aspect-square rounded-full overflow-hidden ring-4 ring-white/70 shadow-cloud"
                      style={{ background: "var(--gradient-lavender)" }}
                    >
                      <img
                        src={pregnancyHero}
                        alt="Pregnancy"
                        width={512}
                        height={512}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute -bottom-2 -right-2 rounded-full bg-white px-3 py-1.5 shadow-soft text-xs font-semibold text-[color:var(--lavender-deep)]">
                      {preg.trimester === 1 ? "1st" : preg.trimester === 2 ? "2nd" : "3rd"}{" "}
                      Trimester
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="font-display text-4xl font-semibold text-[color:var(--lavender-deep)] leading-tight">
                        {preg.week}{" "}
                        <span className="text-2xl font-normal text-muted-foreground">weeks</span> +{" "}
                        {preg.day}{" "}
                        <span className="text-2xl font-normal text-muted-foreground">days</span>
                      </div>
                      <p className="text-xs italic text-muted-foreground mt-1">
                        Due: {dueDate} · {preg.daysToGo} days to go
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="uppercase tracking-widest text-muted-foreground">
                          Progress
                        </span>
                        <span className="font-semibold text-[color:var(--lavender-deep)]">
                          {preg.progressPct}%
                        </span>
                      </div>
                      <CloudBar value={preg.progressPct} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/70 p-3 text-center">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Baby size
                        </div>
                        <div className="font-display text-lg text-foreground">{preg.baby.size}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {preg.baby.lengthCm} cm · {preg.baby.weightG} g
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/70 p-3 text-center">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Baby kicks
                        </div>
                        <div className="font-display text-lg text-foreground">
                          {preg.baby.kicksToday} today
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {preg.baby.movement} <Footprints className="inline h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <TimelineDialog currentWeek={preg.week} />
              </Panel>
            </section>
          )}

          {/* Baby */}
          {show("baby", "pregnancy") && (
            <section className="col-span-12 lg:col-span-4">
              <Panel>
                <PanelHeader
                  eyebrow="Baby"
                  title={preg.babyName ? `All about ${preg.babyName}` : "All about your little one"}
                />
                <div className="relative mx-auto aspect-square w-44 rounded-full overflow-hidden ring-4 ring-white/70 shadow-cloud mb-4">
                  <img
                    src={babyHero}
                    alt="Baby"
                    width={400}
                    height={400}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-2.5 text-sm">
                  <Row
                    label="Heartbeat"
                    value={preg.baby.heartbeat ? `${preg.baby.heartbeat} bpm` : "Too early"}
                    icon={<Heart className="h-3.5 w-3.5 text-[color:var(--blush)]" />}
                  />
                  <Row label="Movement" value={preg.baby.movement} />
                  <Row label="Position" value={preg.baby.position} />
                  <Row label="Weight" value={`${(preg.baby.weightG / 453.6).toFixed(1)} lbs`} />
                  <Row label="Length" value={`${(preg.baby.lengthCm / 2.54).toFixed(1)} in`} />
                </div>
                <p className="mt-3 text-center text-xs italic text-muted-foreground">
                  {preg.baby.note}
                </p>
                <PrimaryButton onClick={() => act("kick")}>Log a kick 👶</PrimaryButton>
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
            </section>
          )}

          {/* Health */}
          {show("health") && (
            <section className="col-span-12 md:col-span-6 lg:col-span-4">
              <Panel>
                <PanelHeader eyebrow="Health" title="Monitor your well-being" />
                <div className="space-y-4">
                  <Meter icon={Zap} label="Energy" value={stats.energy} />
                  <Meter icon={Activity} label="Immunity" value={stats.immunity} />
                  <Meter icon={Smile} label="Mood" value={stats.mood} tone="blush" />
                  <Meter icon={Droplet} label="Hydration" value={stats.hydration} />
                </div>
                <div className="mt-5 rounded-2xl bg-white/60 px-4 py-3 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-[color:var(--lavender)] flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-xs italic text-muted-foreground">
                    {data.wellness >= 75
                      ? "You're doing great! Keep taking care of yourself."
                      : data.wellness >= 50
                        ? "A little self-care would feel lovely right now."
                        : "Baby needs you rested — drink, eat and take a break."}{" "}
                    <span className="text-[color:var(--blush)]">♥</span>
                  </p>
                </div>
                <PrimaryButton onClick={() => act("doctor")}>
                  <span className="inline-flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" /> Visit the doctor
                  </span>
                </PrimaryButton>
              </Panel>
            </section>
          )}

          {/* Symptoms */}
          {show("health") && (
            <section className="col-span-12 md:col-span-6 lg:col-span-4">
              <Panel>
                <PanelHeader eyebrow="Symptoms" title="Track how you feel" />
                <div className="space-y-3">
                  {data.symptoms.map((s) => (
                    <div key={s.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-foreground">{s.name}</span>
                        <span className="text-muted-foreground italic">{s.label}</span>
                      </div>
                      <CloudBar value={s.severity} tone="blush" />
                    </div>
                  ))}
                </div>
                <SymptomsDialog
                  symptoms={data.symptoms}
                  onSave={(name, severity) => act("symptom_log", { name, severity })}
                />
              </Panel>
            </section>
          )}

          {/* Care & Comfort */}
          {show("care") && (
            <section className="col-span-12 md:col-span-6 lg:col-span-4">
              <Panel>
                <PanelHeader eyebrow="Care & Comfort" title="Take care of your needs" />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      icon: Moon,
                      label: "Rest",
                      val: stats.rest,
                      actionLabel: "Rest",
                      action: "rest",
                    },
                    {
                      icon: Droplet,
                      label: "Water",
                      val: stats.hydration,
                      actionLabel: "Drink",
                      action: "drink_water",
                    },
                    {
                      icon: Pill,
                      label: "Vitamins",
                      val: stats.vitamins,
                      actionLabel: "Take",
                      action: "vitamins",
                    },
                    {
                      icon: Stethoscope,
                      label: "Medicine",
                      val: 100 - stats.sickness,
                      actionLabel: "Take",
                      action: "medicine",
                    },
                    {
                      icon: Heart,
                      label: "Comfort",
                      val: stats.comfort,
                      actionLabel: "Cozy up",
                      action: "comfort",
                    },
                  ].map(({ icon: Icon, label, val, actionLabel, action: name }) => (
                    <div key={label} className="rounded-2xl bg-white/70 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 rounded-full bg-[color:var(--lavender)]/30 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-[color:var(--lavender-deep)]" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-semibold">{label}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {Math.round(val)}%
                          </div>
                        </div>
                      </div>
                      <CloudBar value={val} />
                      <button
                        onClick={() => act(name)}
                        disabled={action.isPending}
                        className="mt-2 w-full rounded-full py-1 text-[10px] font-medium bg-[color:var(--lavender)]/20 text-[color:var(--lavender-deep)] hover:bg-[color:var(--lavender)]/40 transition disabled:opacity-50"
                      >
                        {actionLabel}
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          )}

          {/* Partner */}
          {show("partner") && (
            <section className="col-span-12 md:col-span-6 lg:col-span-5">
              <Panel>
                <PanelHeader eyebrow="Partner" title="Stronger together" />
                {data.partner.linked ? (
                  <>
                    <div className="rounded-2xl bg-white/70 p-4 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Partner Support
                          </div>
                          <div className="font-display text-lg text-foreground">
                            {data.partner.name}
                          </div>
                        </div>
                        <div className="text-2xl font-display text-[color:var(--lavender-deep)]">
                          {data.partner.support}%
                        </div>
                      </div>
                      <CloudBar value={data.partner.support} />
                    </div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                      Recent activities
                    </div>
                    <ul className="space-y-2">
                      {data.partner.activities.length === 0 && (
                        <li className="rounded-xl bg-white/50 px-3 py-2 text-sm text-muted-foreground italic">
                          No activities yet — they'll appear when your partner uses their HUD.
                        </li>
                      )}
                      {data.partner.activities.map((a, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between rounded-xl bg-white/50 px-3 py-2 text-sm"
                        >
                          <span className="flex items-center gap-2">
                            <Heart className="h-3.5 w-3.5 text-[color:var(--blush)]" /> {a.activity}
                          </span>
                          <span className="text-xs text-muted-foreground italic">
                            {new Date(a.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <PrimaryButton onClick={() => act("hug")}>Send a hug in-world ♥</PrimaryButton>
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      Give this pairing code to your partner. They enter it in their{" "}
                      <b>Nestoria Partner HUD</b> to join your journey.
                    </p>
                    <PairingCode code={data.partner.code} />
                    <p className="mt-4 text-xs italic text-muted-foreground">
                      Once linked, their hugs, water runs and sweet messages show up here — and
                      reach you in-world.
                    </p>
                  </div>
                )}
              </Panel>
            </section>
          )}

          {/* Journal */}
          {show("journal") && (
            <section className="col-span-12 md:col-span-6 lg:col-span-4">
              <Panel>
                <PanelHeader eyebrow="Journal" title="Capture every moment" />
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {data.journal.length === 0 && (
                    <p className="text-center text-sm italic text-muted-foreground">
                      Your story starts here — add your first entry.
                    </p>
                  )}
                  {data.journal.map((m) => {
                    const Icon =
                      m.kind === "milestone"
                        ? Sparkles
                        : m.kind === "memory"
                          ? Camera
                          : m.kind === "appointment"
                            ? Stethoscope
                            : BookHeart;
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 rounded-2xl bg-white/60 px-3 py-2.5"
                      >
                        <div className="h-9 w-9 shrink-0 rounded-full bg-[color:var(--lavender)]/30 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-[color:var(--lavender-deep)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{m.title}</div>
                          <div className="text-[11px] text-muted-foreground italic">
                            {new Date(m.created_at).toLocaleDateString(undefined, {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                        <div
                          className={`h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[10px] ${m.completed ? "bg-[color:var(--lavender)] text-white" : "border border-[color:var(--lavender)]/50"}`}
                        >
                          {m.completed ? "✓" : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <JournalDialog onSave={(entry) => act("journal_add", entry)} />
              </Panel>
            </section>
          )}

          {/* Nutrition */}
          {show("health", "care", "nutrition") && (
            <section className="col-span-12 md:col-span-6 lg:col-span-3">
              <Panel>
                <PanelHeader eyebrow="Nutrition" title="Eat well, feel well" />
                <NutritionRing
                  value={Math.round((stats.hunger + stats.hydration + stats.vitamins) / 3)}
                />
                <div className="space-y-2 text-xs">
                  {(
                    [
                      ["Meals", stats.hunger],
                      ["Water", stats.hydration],
                      ["Vitamins", stats.vitamins],
                    ] as const
                  ).map(([n, v]) => (
                    <div key={n}>
                      <div className="flex justify-between mb-0.5">
                        <span className="font-medium">{n}</span>
                        <span className="text-muted-foreground">{Math.round(v)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/60 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${v}%`, background: "var(--gradient-lavender)" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <PrimaryButton onClick={() => act("eat")}>
                  <span className="inline-flex items-center gap-2">
                    <Utensils className="h-4 w-4" /> Eat a healthy meal
                  </span>
                </PrimaryButton>
              </Panel>
            </section>
          )}

          {/* Today's well-being */}
          {show("care", "health") && (
            <section className="col-span-12">
              <Panel>
                <PanelHeader eyebrow="Meters in context" title="Today's well-being" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <Meter icon={Utensils} label="Hunger" value={stats.hunger} />
                  <Meter icon={Droplet} label="Bladder" value={stats.bladder} />
                  <Meter icon={Heart} label="Sickness" value={stats.sickness} tone="blush" />
                  <Meter icon={Zap} label="Energy" value={stats.energy} />
                  <Meter icon={Smile} label="Mood" value={stats.mood} tone="blush" />
                  <Meter icon={Droplet} label="Hydration" value={stats.hydration} />
                </div>
                {stats.bladder < 30 && (
                  <button
                    onClick={() => act("bathroom")}
                    className="mx-auto mt-4 block rounded-full bg-white/70 px-5 py-2 text-sm font-medium text-[color:var(--lavender-deep)] hover:bg-white transition"
                  >
                    🚻 Quick bathroom break
                  </button>
                )}
              </Panel>
            </section>
          )}

          {/* Notifications */}
          {active === "notifications" && (
            <section className="col-span-12 md:col-span-9 lg:col-span-6">
              <Panel>
                <PanelHeader eyebrow="Notifications" title="Little updates" />
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {data.notifications.length === 0 && (
                    <p className="text-center text-sm italic text-muted-foreground">
                      All quiet for now ♥
                    </p>
                  )}
                  {data.notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-2xl px-4 py-3 ${n.read ? "bg-white/40" : "bg-white/80 ring-1 ring-[color:var(--lavender)]/40"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">{n.title}</div>
                        <div className="text-[10px] text-muted-foreground italic">
                          {new Date(n.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    </div>
                  ))}
                </div>
                {data.unread > 0 && (
                  <PrimaryButton onClick={() => act("notifications_read")}>
                    Mark all as read
                  </PrimaryButton>
                )}
              </Panel>
            </section>
          )}

          {/* Settings */}
          {active === "settings" && (
            <SettingsPanel
              key={preg.id + preg.babyGender + (preg.babyName ?? "") + preg.durationDays}
              data={data}
              onSave={(params) => act("settings_update", params)}
            />
          )}

          {show("pregnancy", "care", "baby", "partner", "journal", "health", "nutrition") && (
            <ActionConsole data={data} onAction={act} />
          )}

          {/* Quick actions */}
          {show("pregnancy", "care", "baby", "partner", "journal", "health") && (
            <section className="col-span-12 md:col-span-8">
              <Panel>
                <div className="flex items-center gap-6 flex-wrap justify-center">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Quick Actions
                  </div>
                  <QuickAction icon={Heart} label="Hug" onClick={() => act("hug")} />
                  <QuickAction icon={Droplet} label="Water" onClick={() => act("drink_water")} />
                  <QuickAction icon={Pill} label="Vitamins" onClick={() => act("vitamins")} />
                  <QuickAction icon={Stethoscope} label="Medicine" onClick={() => act("medicine")} />
                  <QuickAction icon={Moon} label="Rest" onClick={() => act("rest")} />
                  <QuickAction
                    icon={MessageCircle}
                    label="Support"
                    onClick={() => act("support")}
                  />
                  <QuickAction icon={Stethoscope} label="Doctor" onClick={() => act("doctor")} />
                  <MemoryDialog onSave={(entry) => act("memory", entry)} />
                  <EventDialog onSave={(entry) => act("event", entry)} />
                </div>
              </Panel>
            </section>
          )}

          {show("pregnancy", "care", "baby", "partner", "journal", "health") && (
            <section className="col-span-12 md:col-span-4">
              <Panel className="h-full flex flex-col justify-center text-center">
                <div className="font-display italic text-lg text-[color:var(--lavender-deep)] leading-snug">
                  “Small steps today,
                  <br /> beautiful moments forever.”
                </div>
                <div className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3" /> Nestoria HUD v1.0
                </div>
              </Panel>
            </section>
          )}
        </div>
      </main>

      <footer className="relative z-10 pb-6 text-center text-xs text-muted-foreground">
        <p className="font-script text-lg text-[color:var(--lavender-deep)]">Nestoria</p>
        <p>Where every family journey begins - Pregnancy & Family HUD for Second Life</p>
      </footer>
      </div>
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
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4 py-8">
        <Panel className="w-full">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-between rounded-3xl bg-white/65 p-5">
              <div>
                <img src={logo} alt="Nestoria logo" width={88} height={88} className="h-16 w-16" />
                <h1 className="mt-3 font-display text-4xl font-semibold text-[color:var(--lavender-deep)]">
                  Welcome to Nestoria
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create the pregnancy profile that this MOAP HUD will sync with Render, Postgres,
                  and your Second Life attachment.
                </p>
              </div>
              <div className="mt-6 rounded-2xl bg-white/70 p-4 text-sm">
                <div className="font-semibold text-foreground">Profile Summary</div>
                <div className="mt-2 space-y-1 text-muted-foreground">
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
                    max={42}
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
      <Toaster position="top-center" />
    </Shell>
  );
}

function ActionConsole({
  data,
  onAction,
}: {
  data: HudState;
  onAction: (name: string, params?: Record<string, unknown>) => void;
}) {
  const craving = data.currentCraving?.craving ?? "Ham sub";
  const eventType = data.recentEvents[0]?.event_type ?? "baby_kick";
  const foodItems = data.foods.map((food) => ({
    icon: Utensils,
    label: food.name,
    action: "food_eat",
    params: { food: food.key },
  }));
  const actionGroups = [
    {
      title: "Home",
      items: [
        { icon: RefreshCw, label: "Sync", action: "daily_checkin" },
        { icon: HandHeart, label: "Hold Belly", action: "hold_belly" },
      ],
    },
    {
      title: "Pregnancy",
      items: [
        { icon: Calendar, label: "Timeline", action: "baby_size" },
        { icon: Camera, label: "Ultrasound", action: "ultrasound" },
        { icon: Stethoscope, label: "Appointment", action: "appointment" },
        {
          icon: Sparkles,
          label: "Due Date",
          action: "set_due_date",
          params: { dueDate: data.pregnancy.dueDate },
        },
      ],
    },
    {
      title: "Baby",
      items: [
        { icon: Heart, label: "Heartbeat", action: "heartbeat" },
        { icon: Footprints, label: "Kicks", action: "kick" },
        { icon: Mic, label: "Talk", action: "talk_to_baby" },
        { icon: Baby, label: "Position", action: "baby_position" },
      ],
    },
    {
      title: "Care",
      items: [
        { icon: Moon, label: "Rest", action: "rest" },
        { icon: Droplet, label: "Water", action: "drink_water" },
        { icon: Pill, label: "Vitamins", action: "vitamins" },
        { icon: Stethoscope, label: "Medicine", action: "medicine" },
        { icon: Waves, label: "Breathe", action: "breathe" },
        { icon: Heart, label: "Comfort", action: "comfort" },
        { icon: Sparkles, label: "Bath", action: "warm_bath" },
      ],
    },
    {
      title: "Nutrition",
      items: [
        { icon: Utensils, label: "Meal", action: "eat" },
        { icon: Apple, label: "Snack", action: "snack" },
        { icon: Sparkles, label: "Craving", action: "craving_roll" },
        {
          icon: Utensils,
          label: "Eat Craving",
          action: "craving_choice",
          params: { choice: "eat" },
        },
        { icon: Check, label: "Swap", action: "craving_choice", params: { choice: "healthy" } },
        { icon: Users, label: "Ask", action: "craving_choice", params: { choice: "ask_partner" } },
        { icon: BookHeart, label: "Save", action: "craving_choice", params: { choice: "journal" } },
        { icon: Bell, label: "Ignore", action: "craving_choice", params: { choice: "ignore" } },
      ],
    },
    {
      title: "Food Items",
      items: foodItems,
    },
    {
      title: "Partner / Events",
      items: [
        {
          icon: Users,
          label: "Support",
          action: "ask_partner",
          params: { request: `${data.user.name} could use a little support.` },
        },
        { icon: Bell, label: "Roll Event", action: "random_event_roll" },
        {
          icon: Stethoscope,
          label: "Medicine",
          action: "random_event_choice",
          params: { eventType, choice: "medicine" },
        },
        {
          icon: Apple,
          label: "Snack",
          action: "random_event_choice",
          params: { eventType, choice: "snack" },
        },
        {
          icon: HandHeart,
          label: "Rub Belly",
          action: "random_event_choice",
          params: { eventType, choice: "rub_belly" },
        },
        {
          icon: BookHeart,
          label: "Journal",
          action: "random_event_choice",
          params: { eventType, choice: "journal" },
        },
      ],
    },
  ];

  return (
    <section className="col-span-12">
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--lavender-deep)]/70">
              MOAP Action Console
            </div>
            <h2 className="font-display text-2xl font-semibold text-foreground">
              Production buttons
            </h2>
          </div>
          <div className="rounded-2xl bg-white/70 px-4 py-2 text-xs text-muted-foreground">
            Current craving: <span className="font-semibold text-foreground">{craving}</span>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {actionGroups.map((group) => (
            <div key={group.title} className="rounded-2xl bg-white/60 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.title}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {group.items.map(({ icon: Icon, label, action, params }) => (
                  <button
                    key={`${group.title}-${label}`}
                    onClick={() => onAction(action, params)}
                    className="flex h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-white/75 px-2 text-center text-[11px] font-semibold leading-tight text-[color:var(--lavender-deep)] shadow-soft transition hover:bg-white"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
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
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </button>
  );
}

function NutritionRing({ value }: { value: number }) {
  return (
    <div className="flex flex-col items-center mb-4">
      <div className="relative h-28 w-28">
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
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
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
  onSave,
}: {
  onSave: (entry: { title: string; body: string; kind: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("note");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        </div>
        <DialogFooter>
          <button
            onClick={() => {
              if (!title.trim()) {
                toast.error("Give your entry a title ♥");
                return;
              }
              onSave({ title, body, kind });
              setTitle("");
              setBody("");
              setKind("note");
              setOpen(false);
            }}
            className="w-full rounded-full py-2.5 font-medium text-white shadow-soft transition hover:brightness-105"
            style={{ background: "var(--gradient-lavender)" }}
          >
            Save entry
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
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Memory
          </span>
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
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Event</span>
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

function SettingsPanel({
  data,
  onSave,
}: {
  data: HudState;
  onSave: (params: Record<string, unknown>) => void;
}) {
  const [babyName, setBabyName] = useState(data.pregnancy.babyName ?? "");
  const [babyGender, setBabyGender] = useState(data.pregnancy.babyGender);
  const [durationDays, setDurationDays] = useState(String(data.pregnancy.durationDays));
  return (
    <section className="col-span-12 md:col-span-9 lg:col-span-6">
      <Panel>
        <PanelHeader eyebrow="Settings" title="Your journey, your way" />
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
            <p className="text-xs text-muted-foreground">
              How many real-life days the full 40 weeks take. Most Second Life pregnancies run 14–45
              days.
            </p>
          </div>
        </div>
        <PrimaryButton
          onClick={() => onSave({ babyName, babyGender, durationDays: Number(durationDays) })}
        >
          Save settings
        </PrimaryButton>
      </Panel>
    </section>
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
            <span className="absolute -top-1.5 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--blush)] px-1.5 text-[10px] font-bold text-white shadow-soft">
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
                  <span className="absolute right-4 top-4 rounded-full bg-[color:var(--blush)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-soft">
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
