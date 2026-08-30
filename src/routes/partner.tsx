import { createFileRoute } from "@tanstack/react-router";
import { useRef, useEffect } from "react";
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
  Users,
} from "lucide-react";
import logo from "@/assets/nestoria-logo.png";
import { Toaster } from "@/components/ui/sonner";
import { HudFrame, Panel, PanelHeader, PrimaryButton, Shell, useHudZoom } from "@/components/hud/chrome";
import { useHudState, useHudAction } from "@/lib/hud-api";
import { playForAction, playChime, playError } from "@/lib/sounds";

export const Route = createFileRoute("/partner")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: PartnerPage,
});

function PartnerPage() {
  const { token } = Route.useSearch();
  const state = useHudState(token ?? null);
  const hudZoom = useHudZoom();

  if (!token) {
    return (
      <Shell>
        <HudFrame {...hudZoom}>
          <div className="flex min-h-screen items-center justify-center px-6">
            <Panel className="max-w-lg text-center">
              <img src={logo} alt="Nestoria" className="mx-auto h-16 w-16" />
              <h1 className="mt-3 font-display text-3xl text-[color:var(--lavender-deep)]">
                Nestoria Partner
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Wear the Partner HUD in Second Life and enter her pairing code. This screen loads
                automatically on the HUD face.
              </p>
            </Panel>
          </div>
        </HudFrame>
        <Toaster position="top-center" />
      </Shell>
    );
  }

  if (state.isLoading) {
    return (
      <Shell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[color:var(--lavender-deep)]" />
        </div>
      </Shell>
    );
  }

  if (state.isError || !state.data || state.data.error) {
    return (
      <Shell>
        <HudFrame {...hudZoom}>
          <div className="flex min-h-[60vh] items-center justify-center px-6">
            <Panel className="max-w-md text-center">
              <PanelHeader title="Not linked yet" />
              <p className="text-sm text-muted-foreground">
                Touch the Partner HUD and enter the 6-character code from her Partner panel.
              </p>
            </Panel>
          </div>
        </HudFrame>
        <Toaster position="top-center" />
      </Shell>
    );
  }

  return <PartnerDashboard token={token} />;
}

function PartnerDashboard({ token }: { token: string }) {
  const state = useHudState(token);
  const data = state.data!;
  const action = useHudAction(token);
  const hudZoom = useHudZoom();
  const unreadRef = useRef(data.unread);

  useEffect(() => {
    if (data.unread > unreadRef.current) playChime();
    unreadRef.current = data.unread;
  }, [data.unread]);

  const act = (name: string, params?: Record<string, unknown>) =>
    action.mutate(
      { action: name, params },
      {
        onSuccess: (res) => {
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
  const inLabor = labor && labor.stage !== "none" && labor.stage !== "delivered";
  return (
    <Shell>
      <HudFrame {...hudZoom}>
        <header className="mx-auto max-w-[1680px] px-6 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Nestoria" className="h-12 w-12" />
            <div>
              <h1 className="font-display text-3xl text-[color:var(--lavender-deep)]">
                Partner HUD
              </h1>
              <p className="font-script text-sm text-[color:var(--lavender-deep)]/70">
                stay close · stay present
              </p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1680px] px-6 pb-20">
          <div className="grid grid-cols-12 gap-4">
            <section className="col-span-12 @min-[768px]:col-span-5">
              <Panel>
                <PanelHeader
                  eyebrow="How she is"
                  title={
                    data.mood
                      ? `${data.mood.emoji} ${data.mood.label}`
                      : `Week ${preg.week}+${preg.day}`
                  }
                  subtitle={`Week ${preg.week}+${preg.day} · ${preg.baby.kicksToday} kicks today`}
                />
                {data.mood && (
                  <>
                    <p className="text-center text-sm text-muted-foreground">{data.mood.hint}</p>
                    <p className="mt-2 text-center text-xs italic text-muted-foreground">
                      Every swing pings you. Hunger, rest, and stress make some feelings more likely.
                    </p>
                  </>
                )}
                {preg.delivered && (
                  <p className="mt-3 text-center text-sm text-[color:var(--lavender-deep)]">
                    This pregnancy is marked delivered. Stay with her for the new chapter.
                  </p>
                )}
                {inLabor && (
                  <div className="mt-4 rounded-2xl bg-[color:var(--blush)]/20 px-4 py-3 text-center text-sm">
                    {labor.waterBroken ? "Water has broken. " : ""}
                    {labor.stage === "hospital" ? "She is at the hospital. " : ""}
                    Contractions {labor.intensity}%. She needs you.
                  </div>
                )}
              </Panel>
            </section>

            <section className="col-span-12 @min-[768px]:col-span-7">
              <Panel>
                <PanelHeader eyebrow="Support" title="Be there" />
                <div className="grid grid-cols-2 @min-[640px]:grid-cols-3 gap-2">
                  {[
                    { icon: Heart, label: "Comfort", action: "partner_comfort" },
                    { icon: Users, label: "Hug", action: "hug" },
                    { icon: Droplet, label: "Ice chips", action: "partner_ice_chips" },
                    { icon: Stethoscope, label: "Medicine", action: "partner_medicine" },
                    { icon: Moon, label: "Help rest", action: "partner_help_rest" },
                    { icon: HandHeart, label: "Check on her", action: "partner_check_on" },
                    { icon: Briefcase, label: "Help pack bag", action: "partner_pack_bag" },
                    { icon: Sparkles, label: "Celebrate", action: "partner_celebrate" },
                    { icon: Stethoscope, label: "Appointment", action: "partner_appointment" },
                  ].map(({ icon: Icon, label, action: name }) => (
                    <button
                      key={name}
                      onClick={() => act(name)}
                      disabled={action.isPending}
                      className="rounded-2xl bg-white/70 px-3 py-3 text-xs font-semibold text-[color:var(--lavender-deep)] hover:bg-white disabled:opacity-50"
                    >
                      <Icon className="mx-auto mb-1 h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </Panel>
            </section>

            {inLabor && (
              <section className="col-span-12">
                <Panel>
                  <PanelHeader eyebrow="Labor" title="Stay with her" />
                  <div className="grid grid-cols-2 @min-[640px]:grid-cols-4 gap-2">
                    <PrimaryButton onClick={() => act("partner_labor_support")}>
                      Hold her hand
                    </PrimaryButton>
                    <PrimaryButton onClick={() => act("partner_breathing")}>
                      Guide breathing
                    </PrimaryButton>
                    <PrimaryButton onClick={() => act("partner_backrub")}>
                      Back rub
                    </PrimaryButton>
                    <PrimaryButton onClick={() => act("partner_stay_strong")}>
                      Stay strong
                    </PrimaryButton>
                  </div>
                  <p className="mt-3 text-center text-xs italic text-muted-foreground">
                    Optional reactions if the scene goes that way — they do not replace being
                    present.
                  </p>
                  <div className="mt-2 flex justify-center gap-2">
                    <button
                      onClick={() => act("partner_faint")}
                      className="rounded-full bg-white/70 px-3 py-1.5 text-[11px]"
                    >
                      Feel faint
                    </button>
                    <button
                      onClick={() => act("partner_vomit_react")}
                      className="rounded-full bg-white/70 px-3 py-1.5 text-[11px]"
                    >
                      Get queasy
                    </button>
                  </div>
                </Panel>
              </section>
            )}

            <section className="col-span-12 @min-[768px]:col-span-7">
              <Panel>
                <PanelHeader eyebrow="Alerts" title="What she needs" />
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.notifications.length === 0 && (
                    <p className="text-center text-sm italic text-muted-foreground">
                      Quiet for now. Stay close.
                    </p>
                  )}
                  {data.notifications.map((n) => (
                    <div key={n.id} className="rounded-2xl bg-white/60 px-3 py-2">
                      <div className="text-sm font-semibold">{n.title}</div>
                      {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    </div>
                  ))}
                </div>
                {data.unread > 0 && (
                  <PrimaryButton onClick={() => act("notifications_read")}>
                    <Bell className="mr-2 inline h-4 w-4" /> Mark read
                  </PrimaryButton>
                )}
              </Panel>
            </section>

            <section className="col-span-12 @min-[768px]:col-span-5">
              <Panel>
                <PanelHeader eyebrow="Together" title="Recent moments" />
                <ul className="space-y-2">
                  {data.partner.activities.map((a, i) => (
                    <li key={i} className="rounded-xl bg-white/60 px-3 py-2 text-sm">
                      {a.activity}
                    </li>
                  ))}
                </ul>
              </Panel>
            </section>
          </div>
        </main>
      </HudFrame>
      <Toaster position="top-center" />
    </Shell>
  );
}
