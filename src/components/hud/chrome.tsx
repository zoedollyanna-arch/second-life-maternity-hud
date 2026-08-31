import { useCallback, useRef, type ReactNode } from "react";

/** Layout fills the MOAP face. Do not apply transform:scale or zoom. */
export const HUD_DESIGN_WIDTH = 800;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 1;
export const ZOOM_STEP = 0.05;
export const ZOOM_STORAGE_KEY = "nestoriaHudZoomV5";

export const clampZoom = (value: number) => 1;

const PIP_COUNT = 6;

export function CloudBar({
  value,
  tone = "lavender",
}: {
  value: number;
  tone?: "lavender" | "blush" | "cream";
}) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * PIP_COUNT);
  const fill =
    tone === "blush"
      ? "linear-gradient(180deg, #F6C6D6 0%, #E8A8BC 100%)"
      : tone === "cream"
        ? "linear-gradient(180deg, #FFF4E6 0%, #F0D9B0 100%)"
        : "linear-gradient(180deg, #D6C6E7 0%, #A77ACB 100%)";
  return (
    <div
      className="hud-cloud-pips"
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: PIP_COUNT }).map((_, i) => (
        <span
          key={i}
          className="hud-cloud-pip"
          style={{
            background: i < filled ? fill : "#E9E3EF",
            boxShadow: i < filled ? "0 2px 6px #A77ACB44" : "none",
          }}
        />
      ))}
    </div>
  );
}

export function Meter({
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
    <div className="hud-meter">
      <div className="hud-meter-icon">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="hud-copy truncate font-semibold">{label}</span>
          <span className="hud-copy shrink-0 font-bold text-[#A77ACB]">{Math.round(value)}%</span>
        </div>
        <CloudBar value={value} tone={tone} />
      </div>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`hud-card ${className}`}>{children}</div>;
}

export function PanelHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-2 min-w-0 text-center">
      {eyebrow && <div className="hud-label">{eyebrow}</div>}
      <h2 className="hud-title mt-0.5 text-[#4D405E]">{title}</h2>
      {subtitle && <p className="hud-muted mt-0.5 italic">{subtitle}</p>}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="hud-btn-primary mt-3 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2">
      <span className="hud-copy flex min-w-0 items-center gap-1.5 truncate font-semibold">
        {icon}
        {label}
      </span>
      <span className="hud-body min-w-0 truncate text-right font-semibold text-[#4D405E]">{value}</span>
    </div>
  );
}

export function useHudZoom() {
  const metrics = useRef<{ renderedHeight: number; viewportHeight: number } | null>(null);
  const setZoom = useCallback((_next: number) => 1, []);
  const onMetrics = useCallback((next: { renderedHeight: number; viewportHeight: number }) => {
    metrics.current = next;
  }, []);
  const fit = useCallback(() => 1, []);
  return { zoom: 1, setZoom, onMetrics, fit };
}

/** Full-viewport tablet chrome. No transform:scale — layout reflows to the MOAP face. */
export function HudFrame({
  zoom: _zoom,
  setZoom: _setZoom,
  onMetrics: _onMetrics,
  fit: _fit,
  children,
}: ReturnType<typeof useHudZoom> & { children: ReactNode }) {
  return <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>;
}

export function Ambient() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white/80"
            style={{
              top: `${(i * 37) % 100}%`,
              left: `${(i * 53) % 100}%`,
              boxShadow: "0 0 6px 1px #D6C6E799",
              animation: `twinkle ${3 + (i % 4)}s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`@keyframes twinkle { 0%,100%{opacity:.25;transform:scale(.8)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes meterSheen { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }`}</style>
    </>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="hud-shell">
      <Ambient />
      {children}
    </div>
  );
}
