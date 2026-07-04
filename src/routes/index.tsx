import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Home, Heart, Baby, Users, BookHeart, Bell, Settings, Activity,
  Droplet, Pill, Moon, Utensils, Zap, Smile, Footprints, Calendar,
  Camera, Sparkles, ChevronRight, Plus, MessageCircle, Stethoscope,
} from "lucide-react";
import logo from "@/assets/nestoria-logo.png";
import pregnancyHero from "@/assets/pregnancy-hero.jpg";
import babyHero from "@/assets/baby-hero.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

type NavKey =
  | "home" | "pregnancy" | "health" | "baby" | "care" | "partner"
  | "journal" | "notifications" | "settings";

const NAV: { key: NavKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "pregnancy", label: "Pregnancy", icon: Sparkles },
  { key: "health", label: "Health", icon: Heart },
  { key: "baby", label: "Baby", icon: Baby },
  { key: "care", label: "Care & Comfort", icon: Moon },
  { key: "partner", label: "Partner", icon: Users },
  { key: "journal", label: "Journal", icon: BookHeart },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "settings", label: "Settings", icon: Settings },
];

function CloudBar({ value, tone = "lavender" }: { value: number; tone?: "lavender" | "blush" | "cream" }) {
  const gradient =
    tone === "blush"
      ? "linear-gradient(90deg, oklch(0.82 0.1 355) 0%, oklch(0.88 0.08 355) 60%, oklch(0.95 0.02 355) 100%)"
      : tone === "cream"
        ? "linear-gradient(90deg, oklch(0.88 0.08 80) 0%, oklch(0.94 0.05 80) 60%, oklch(0.97 0.02 80) 100%)"
        : "linear-gradient(90deg, oklch(0.72 0.12 300) 0%, oklch(0.82 0.09 305) 55%, oklch(0.94 0.03 305) 100%)";
  return (
    <div className="relative h-6 w-full rounded-full overflow-hidden" style={{
      background: "oklch(0.96 0.012 305)",
      boxShadow: "inset 0 2px 4px oklch(0.55 0.15 300 / 0.15)",
    }}>
      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
        style={{ width: `${value}%`, background: gradient }}>
        {/* cloud bumps */}
        <div className="absolute inset-0 flex items-center gap-1 px-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="h-3 w-3 rounded-full bg-white/60 blur-[1px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Meter({ icon: Icon, label, value, tone = "lavender" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone?: "lavender" | "blush" | "cream" }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 shadow-soft">
        <Icon className="h-4 w-4 text-[color:var(--lavender-deep)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
          <span className="text-xs font-semibold text-[color:var(--lavender-deep)]">{value}%</span>
        </div>
        <CloudBar value={value} tone={tone} />
      </div>
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] bg-card/85 backdrop-blur-xl shadow-cloud ring-1 ring-white/60 p-6 ${className}`}>
      {children}
    </div>
  );
}

function PanelHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-5 text-center">
      {eyebrow && <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--lavender-deep)]/70">{eyebrow}</div>}
      <h2 className="mt-1 text-2xl font-display font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="text-xs italic text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Index() {
  const [active, setActive] = useState<NavKey>("home");

  return (
    <div className="min-h-screen w-full">
      {/* Ambient sparkles background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i}
            className="absolute h-1 w-1 rounded-full bg-white/70"
            style={{
              top: `${(i * 37) % 100}%`,
              left: `${(i * 53) % 100}%`,
              boxShadow: "0 0 8px 2px oklch(0.9 0.05 300 / 0.6)",
              animation: `twinkle ${3 + (i % 4)}s ease-in-out ${i * 0.2}s infinite`,
            }} />
        ))}
      </div>
      <style>{`@keyframes twinkle { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1.3)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>

      {/* Header */}
      <header className="relative z-10 mx-auto max-w-[1400px] px-6 pt-8 pb-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Nestoria logo" width={72} height={72}
              className="h-16 w-16 drop-shadow-[0_4px_12px_oklch(0.55_0.15_300/0.25)]"
              style={{ animation: "float 5s ease-in-out infinite" }} />
            <div>
              <h1 className="font-display text-4xl font-semibold tracking-wide text-[color:var(--lavender-deep)]">
                NESTORIA
              </h1>
              <p className="font-script text-sm text-[color:var(--lavender-deep)]/70">
                where every family journey begins
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 rounded-full bg-card/80 backdrop-blur-md px-5 py-3 shadow-soft">
            <div className="h-10 w-10 rounded-full bg-[color:var(--lavender)] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Welcome back</div>
              <div className="font-display text-lg leading-none">Aria <span className="text-[color:var(--blush)]">♥</span></div>
            </div>
            <div className="ml-3 flex gap-2">
              <button className="relative h-10 w-10 rounded-full bg-white/70 flex items-center justify-center shadow-soft hover:bg-white transition">
                <Bell className="h-4 w-4 text-[color:var(--lavender-deep)]" />
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[color:var(--blush)] text-[9px] font-bold text-white flex items-center justify-center">3</span>
              </button>
              <button className="h-10 w-10 rounded-full bg-white/70 flex items-center justify-center shadow-soft hover:bg-white transition">
                <Settings className="h-4 w-4 text-[color:var(--lavender-deep)]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main dashboard */}
      <main className="relative z-10 mx-auto max-w-[1400px] px-6 pb-28">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <aside className="col-span-12 md:col-span-3 lg:col-span-2">
            <Panel className="p-3">
              <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
                {NAV.map(({ key, label, icon: Icon }) => {
                  const isActive = active === key;
                  return (
                    <button key={key} onClick={() => setActive(key)}
                      className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? "bg-[color:var(--lavender)] text-white shadow-soft"
                          : "text-muted-foreground hover:bg-white/70 hover:text-[color:var(--lavender-deep)]"
                      }`}>
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </nav>
            </Panel>
          </aside>

          {/* Center: Pregnancy hero card */}
          <section className="col-span-12 md:col-span-9 lg:col-span-6">
            <Panel className="relative overflow-hidden">
              <PanelHeader eyebrow="Pregnancy" title="Your beautiful journey" subtitle="every day is a step closer to meeting your little one" />

              <div className="grid grid-cols-2 gap-6 items-center">
                <div className="relative">
                  <div className="aspect-square rounded-full overflow-hidden ring-4 ring-white/70 shadow-cloud"
                    style={{ background: "var(--gradient-lavender)" }}>
                    <img src={pregnancyHero} alt="Pregnancy" width={512} height={512} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 rounded-full bg-white px-3 py-1.5 shadow-soft text-xs font-semibold text-[color:var(--lavender-deep)]">
                    2nd Trimester
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="font-display text-4xl font-semibold text-[color:var(--lavender-deep)] leading-tight">
                      24 <span className="text-2xl font-normal text-muted-foreground">weeks</span> + 3 <span className="text-2xl font-normal text-muted-foreground">days</span>
                    </div>
                    <p className="text-xs italic text-muted-foreground mt-1">Due: August 25, 2024 · 102 days to go</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="uppercase tracking-widest text-muted-foreground">Progress</span>
                      <span className="font-semibold text-[color:var(--lavender-deep)]">61%</span>
                    </div>
                    <CloudBar value={61} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/70 p-3 text-center">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Baby size</div>
                      <div className="font-display text-lg text-foreground">Cantaloupe</div>
                      <div className="text-[10px] text-muted-foreground">30.1 cm · 650 g</div>
                    </div>
                    <div className="rounded-2xl bg-white/70 p-3 text-center">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Baby kicks</div>
                      <div className="font-display text-lg text-foreground">12 today</div>
                      <div className="text-[10px] text-muted-foreground">Very active <Footprints className="inline h-3 w-3" /></div>
                    </div>
                  </div>
                </div>
              </div>

              <button className="mt-6 w-full rounded-full py-3 font-medium text-white shadow-soft transition hover:brightness-105"
                style={{ background: "var(--gradient-lavender)" }}>
                View Pregnancy Timeline
              </button>
            </Panel>
          </section>

          {/* Right: Baby card */}
          <section className="col-span-12 lg:col-span-4">
            <Panel>
              <PanelHeader eyebrow="Baby" title="All about your little one" />
              <div className="relative mx-auto aspect-square w-44 rounded-full overflow-hidden ring-4 ring-white/70 shadow-cloud mb-4">
                <img src={babyHero} alt="Baby" width={400} height={400} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="space-y-2.5 text-sm">
                <Row label="Heartbeat" value="142 bpm" icon={<Heart className="h-3.5 w-3.5 text-[color:var(--blush)]" />} />
                <Row label="Movement" value="Very Active" />
                <Row label="Position" value="Head Down" />
                <Row label="Weight" value="1.5 lbs" />
                <Row label="Length" value="11.8 in" />
              </div>
            </Panel>
          </section>

          {/* Health */}
          <section className="col-span-12 md:col-span-6 lg:col-span-4">
            <Panel>
              <PanelHeader eyebrow="Health" title="Monitor your well-being" />
              <div className="space-y-4">
                <Meter icon={Zap} label="Energy" value={78} />
                <Meter icon={Activity} label="Immunity" value={65} />
                <Meter icon={Smile} label="Mood" value={82} tone="blush" />
                <Meter icon={Droplet} label="Hydration" value={60} />
              </div>
              <div className="mt-5 rounded-2xl bg-white/60 px-4 py-3 flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-[color:var(--lavender)] flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <p className="text-xs italic text-muted-foreground">You're doing great! Keep taking care of yourself. <span className="text-[color:var(--blush)]">♥</span></p>
              </div>
            </Panel>
          </section>

          {/* Symptoms */}
          <section className="col-span-12 md:col-span-6 lg:col-span-4">
            <Panel>
              <PanelHeader eyebrow="Symptoms" title="Track how you feel" />
              <div className="space-y-3">
                {[
                  { name: "Nausea", level: "Mild", val: 30 },
                  { name: "Fatigue", level: "Moderate", val: 55 },
                  { name: "Back Pain", level: "Mild", val: 25 },
                  { name: "Headache", level: "None", val: 5 },
                  { name: "Heartburn", level: "Mild", val: 20 },
                ].map((s) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="text-muted-foreground italic">{s.level}</span>
                    </div>
                    <CloudBar value={s.val} tone="blush" />
                  </div>
                ))}
              </div>
              <button className="mt-5 w-full rounded-full py-2.5 text-sm font-medium text-[color:var(--lavender-deep)] bg-white/70 hover:bg-white transition">
                View all symptoms
              </button>
            </Panel>
          </section>

          {/* Care & Comfort */}
          <section className="col-span-12 md:col-span-6 lg:col-span-4">
            <Panel>
              <PanelHeader eyebrow="Care & Comfort" title="Take care of your needs" />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Moon, label: "Rest", val: 70, action: "Rest" },
                  { icon: Droplet, label: "Water", val: 60, action: "Drink" },
                  { icon: Pill, label: "Vitamins", val: 80, action: "Take" },
                  { icon: Heart, label: "Comfort", val: 65, action: "Use" },
                ].map(({ icon: Icon, label, val, action }) => (
                  <div key={label} className="rounded-2xl bg-white/70 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-full bg-[color:var(--lavender)]/30 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-[color:var(--lavender-deep)]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold">{label}</div>
                        <div className="text-[10px] text-muted-foreground">{val}%</div>
                      </div>
                    </div>
                    <CloudBar value={val} />
                    <button className="mt-2 w-full rounded-full py-1 text-[10px] font-medium bg-[color:var(--lavender)]/20 text-[color:var(--lavender-deep)] hover:bg-[color:var(--lavender)]/40 transition">
                      {action}
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          {/* Partner */}
          <section className="col-span-12 md:col-span-6 lg:col-span-5">
            <Panel>
              <PanelHeader eyebrow="Partner" title="Stronger together" />
              <div className="rounded-2xl bg-white/70 p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Partner Support</div>
                    <div className="font-display text-lg text-foreground">Alex Parker <span className="text-[color:var(--blush)] text-xs">● Online</span></div>
                  </div>
                  <div className="text-2xl font-display text-[color:var(--lavender-deep)]">82%</div>
                </div>
                <CloudBar value={82} />
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Recent activities</div>
              <ul className="space-y-2">
                {[
                  ["Gave affection", "Today"],
                  ["Went to appointment", "May 15"],
                  ["Helped with chores", "May 15"],
                  ["Spent quality time", "May 14"],
                ].map(([act, when]) => (
                  <li key={act} className="flex items-center justify-between rounded-xl bg-white/50 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2"><Heart className="h-3.5 w-3.5 text-[color:var(--blush)]" /> {act}</span>
                    <span className="text-xs text-muted-foreground italic">{when}</span>
                  </li>
                ))}
              </ul>
              <button className="mt-5 w-full rounded-full py-2.5 font-medium text-white shadow-soft transition hover:brightness-105"
                style={{ background: "var(--gradient-lavender)" }}>
                Open Partner Hub
              </button>
            </Panel>
          </section>

          {/* Journal */}
          <section className="col-span-12 md:col-span-6 lg:col-span-4">
            <Panel>
              <PanelHeader eyebrow="Journal" title="Capture every moment" />
              <div className="space-y-2.5">
                {[
                  { icon: Sparkles, title: "First Sickness", date: "April 10, 2024", done: true },
                  { icon: Footprints, title: "First Baby Kick", date: "May 02, 2024", done: true },
                  { icon: Heart, title: "Gender Reveal", date: "June 15, 2024", done: false },
                  { icon: Baby, title: "Baby Shower", date: "July 20, 2024", done: false },
                ].map((m) => (
                  <div key={m.title} className="flex items-center gap-3 rounded-2xl bg-white/60 px-3 py-2.5">
                    <div className="h-9 w-9 rounded-full bg-[color:var(--lavender)]/30 flex items-center justify-center">
                      <m.icon className="h-4 w-4 text-[color:var(--lavender-deep)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{m.title}</div>
                      <div className="text-[11px] text-muted-foreground italic">{m.date}</div>
                    </div>
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${m.done ? "bg-[color:var(--lavender)] text-white" : "border border-[color:var(--lavender)]/50"}`}>
                      {m.done ? "✓" : ""}
                    </div>
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full rounded-full py-2.5 text-sm font-medium text-[color:var(--lavender-deep)] bg-white/70 hover:bg-white transition flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> New Journal Entry
              </button>
            </Panel>
          </section>

          {/* Nutrition */}
          <section className="col-span-12 md:col-span-6 lg:col-span-3">
            <Panel>
              <PanelHeader eyebrow="Nutrition" title="Eat well, feel well" />
              <div className="flex flex-col items-center mb-4">
                <div className="relative h-28 w-28">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r="42" stroke="oklch(0.94 0.02 305)" strokeWidth="10" fill="none" />
                    <circle cx="50" cy="50" r="42" stroke="oklch(0.72 0.12 300)" strokeWidth="10" fill="none"
                      strokeDasharray={`${(72 / 100) * 264} 264`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="font-display text-2xl font-semibold text-[color:var(--lavender-deep)]">72%</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Good</div>
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                {[["Protein", 85], ["Fruits", 70], ["Vegetables", 65], ["Grains", 60], ["Water", 75]].map(([n, v]) => (
                  <div key={n as string}>
                    <div className="flex justify-between mb-0.5"><span className="font-medium">{n}</span><span className="text-muted-foreground">{v}%</span></div>
                    <div className="h-2 rounded-full bg-white/60 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${v}%`, background: "var(--gradient-lavender)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          {/* Quick actions ribbon */}
          <section className="col-span-12">
            <Panel>
              <PanelHeader eyebrow="Meters in context" title="Today's well-being" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <Meter icon={Utensils} label="Hunger" value={60} />
                <Meter icon={Droplet} label="Bladder" value={35} />
                <Meter icon={Heart} label="Sickness" value={20} tone="blush" />
                <Meter icon={Zap} label="Energy" value={78} />
                <Meter icon={Smile} label="Mood" value={82} tone="blush" />
                <Meter icon={Droplet} label="Hydration" value={60} />
              </div>
            </Panel>
          </section>

          {/* Quick actions bar */}
          <section className="col-span-12 md:col-span-8">
            <Panel>
              <div className="flex items-center gap-6 flex-wrap justify-center">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Quick Actions</div>
                {[
                  { icon: Heart, label: "Hug" },
                  { icon: Droplet, label: "Water" },
                  { icon: Pill, label: "Vitamins" },
                  { icon: Moon, label: "Rest" },
                  { icon: MessageCircle, label: "Support" },
                  { icon: Stethoscope, label: "Doctor" },
                  { icon: Camera, label: "Memory" },
                  { icon: Calendar, label: "Event" },
                ].map(({ icon: Icon, label }) => (
                  <button key={label} className="flex flex-col items-center gap-1.5 group">
                    <div className="h-12 w-12 rounded-2xl bg-white/80 shadow-soft flex items-center justify-center group-hover:scale-105 group-hover:bg-white transition-transform">
                      <Icon className="h-5 w-5 text-[color:var(--lavender-deep)]" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
                  </button>
                ))}
              </div>
            </Panel>
          </section>

          <section className="col-span-12 md:col-span-4">
            <Panel className="h-full flex flex-col justify-center text-center">
              <div className="font-display italic text-lg text-[color:var(--lavender-deep)] leading-snug">
                “Small steps today,<br /> beautiful moments forever.”
              </div>
              <div className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Nestoria HUD v1.0
              </div>
            </Panel>
          </section>
        </div>
      </main>

      <footer className="relative z-10 pb-6 text-center text-xs text-muted-foreground">
        <p className="font-script text-lg text-[color:var(--lavender-deep)]">Nestoria</p>
        <p>Where every family journey begins · Pregnancy & Family HUD for Second Life</p>
      </footer>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2">
      <span className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
