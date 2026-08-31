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
          <div className="flex h-full min-h-0 items-center justify-center">
            <Panel className="w-full max-w-[36rem] text-center">
              <img src={logo} alt="Nestoria" className="mx-auto h-16 w-16" />
              <h1 className="hud-brand mt-3">Nestoria Partner</h1>
              <p className="mt-3 hud-copy">
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
        <HudFrame {...hudZoom}>
          <div className="flex min-h-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-[color:var(--lavender-deep)]" />
          </div>
        </HudFrame>
      </Shell>
    );
  }

  if (state.isError || !state.data || state.data.error) {
    return (
      <Shell>
        <HudFrame {...hudZoom}>
          <div className="flex h-full min-h-0 items-center justify-center px-6">
            <Panel className="w-full max-w-[36rem] text-center">
              <PanelHeader title="Not linked yet" />
              <p className="hud-copy">
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
        <div className="hud-app">
          <header className="hud-topbar">
            <div className="flex min-w-0 items-center gap-2">
              <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <div className="hud-brand truncate">NESTORIA</div>
                <div className="hud-muted truncate">Partner · stay close</div>
              </div>
            </div>
            <div className="hud-copy truncate font-semibold">{data.user.name.split(" ")[0]}</div>
          </header>

          <main className="hud-main is-scroll">
            <div className="grid min-w-0 grid-cols-1 gap-2 min-[800px]:grid-cols-2">
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
                    <p className="text-center hud-copy">{data.mood.hint}</p>
                    <p className="mt-2 text-center hud-muted italic">
                      Every swing pings you. Hunger, rest, and stress make some feelings more likely.
                    </p>
                  </>
                )}
                {preg.delivered && (
                  <p className="mt-3 text-center hud-copy">
                    This pregnancy is marked delivered. Stay with her for the new chapter.
                  </p>
                )}
                {inLabor && (
                  <div className="mt-3 rounded-2xl bg-[#F6C6D6]/30 px-3 py-2 text-center hud-copy">
                    {labor.waterBroken ? "Water has broken. " : ""}
                    {labor.stage === "hospital" ? "She is at the hospital. " : ""}
                    Contractions {labor.intensity}%. She needs you.
                  </div>
                )}
              </Panel>

              <Panel>
                <PanelHeader eyebrow="Support" title="Be there" />
                <div className="grid grid-cols-3 gap-2">
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
                      className="hud-action min-h-11 disabled:opacity-50"
                    >
                      <Icon className="h-4 w-4 text-[#A77ACB]" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </Panel>

              {inLabor && (
                <Panel className="min-[800px]:col-span-2">
                  <PanelHeader eyebrow="Labor" title="Stay with her" />
                  <div className="grid grid-cols-2 gap-2 min-[800px]:grid-cols-4">
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
                  <p className="mt-2 text-center hud-muted italic">
                    Optional reactions if the scene goes that way — they do not replace being
                    present.
                  </p>
                  <div className="mt-2 flex justify-center gap-2">
                    <button
                      onClick={() => act("partner_faint")}
                      className="min-h-10 rounded-full bg-white/70 px-4 hud-copy"
                    >
                      Feel faint
                    </button>
                    <button
                      onClick={() => act("partner_vomit_react")}
                      className="min-h-10 rounded-full bg-white/70 px-4 hud-copy"
                    >
                      Get queasy
                    </button>
                  </div>
                </Panel>
              )}

              <Panel className="is-scroll">
                <PanelHeader eyebrow="Alerts" title="What she needs" />
                <div className="space-y-2">
                  {data.notifications.length === 0 && (
                    <p className="text-center hud-muted italic">Quiet for now. Stay close.</p>
                  )}
                  {data.notifications.map((n) => (
                    <div key={n.id} className="rounded-2xl bg-white/60 px-3 py-2">
                      <div className="hud-copy font-semibold">{n.title}</div>
                      {n.body && <p className="hud-muted">{n.body}</p>}
                    </div>
                  ))}
                </div>
                {data.unread > 0 && (
                  <PrimaryButton onClick={() => act("notifications_read")}>
                    <Bell className="mr-2 inline h-4 w-4" /> Mark read
                  </PrimaryButton>
                )}
              </Panel>

              <Panel className="is-scroll">
                <PanelHeader eyebrow="Together" title="Recent moments" />
                <ul className="space-y-2">
                  {data.partner.activities.map((a, i) => (
                    <li key={i} className="rounded-xl bg-white/60 px-3 py-2 hud-copy">
                      {a.activity}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </main>
        </div>
      </HudFrame>
      <Toaster position="top-center" />
    </Shell>
  );
}
