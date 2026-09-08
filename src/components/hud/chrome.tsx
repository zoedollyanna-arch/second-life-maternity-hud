import { useCallback, useRef, type ReactNode } from "react";

import { HudIconDefs } from "./icons";

/** Layout fills the MOAP face. Do not apply transform:scale or zoom. */
export const HUD_DESIGN_WIDTH = 800;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 1;
export const ZOOM_STEP = 0.05;
export const ZOOM_STORAGE_KEY = "nestoriaHudZoomV5";

export const clampZoom = (value: number) => 1;

const PIP_COUNT = 6;

export type CloudTone = "lavender" | "blush" | "cream" | "sky";

/**
 * One little cloud, shaded the same way the tile icons are: a radial gradient
 * lit from the top left, a soft contact shadow, and a blurred catchlight. The
 * gradients live in <HudIconDefs />, rendered once by Shell — url(#id) resolves
 * document-wide, so defining them per pip would mean dozens of duplicate ids.
 */
function CloudPip({ filled, tone }: { filled: boolean; tone: CloudTone }) {
  const fill = filled ? `url(#nv-pip-${tone})` : "url(#nv-pip-empty)";
  return (
    <svg className="hud-cloud-pip" viewBox="0 0 32 21" aria-hidden focusable="false">
      <g fill={fill} filter={filled ? "url(#nv-pip-shadow)" : undefined}>
        <circle cx="9" cy="12" r="5.6" />
        <circle cx="17" cy="9.4" r="7.4" />
        <circle cx="24.5" cy="12.6" r="5" />
        <rect x="7" y="12" width="20" height="8" rx="4" />
      </g>
      <ellipse
        cx="14"
        cy="7.4"
        rx="4.6"
        ry="2.4"
        fill="#FFFFFF"
        opacity={filled ? 0.5 : 0.85}
        filter="url(#nv-soften-sm)"
        transform="rotate(-16 14 7.4)"
      />
    </svg>
  );
}

export function CloudBar({ value, tone = "lavender" }: { value: number; tone?: CloudTone }) {
  const safe = Math.max(0, Math.min(100, value));
  const filled = Math.round((safe / 100) * PIP_COUNT);
  return (
    <div
      className="hud-cloud-pips"
      role="meter"
      aria-valuenow={Math.round(safe)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: PIP_COUNT }).map((_, i) => (
        <CloudPip key={i} filled={i < filled} tone={tone} />
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

export function Row({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2">
      <span className="hud-copy flex min-w-0 items-center gap-1.5 truncate font-semibold">
        {icon}
        {label}
      </span>
      <span className="hud-body min-w-0 truncate text-right font-semibold text-[#4D405E]">
        {value}
      </span>
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
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
  );
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
      {/* Gradients and filters every icon and meter pip references. Once per
          document — see the note in icons.tsx about duplicate SVG ids. */}
      <HudIconDefs />
      <Ambient />
      {children}
    </div>
  );
}
