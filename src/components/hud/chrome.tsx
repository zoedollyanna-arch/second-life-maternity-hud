import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";

/** Kept for settings/accessibility text density. Layout no longer uses transform scale. */
export const HUD_DESIGN_WIDTH = 1024;
export const MIN_ZOOM = 0.85;
export const MAX_ZOOM = 1.2;
export const ZOOM_STEP = 0.05;
export const ZOOM_STORAGE_KEY = "nestoriaHudZoomV5";

export const clampZoom = (value: number) =>
  Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)) * 100) / 100;

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
      className="flex min-w-0 items-center gap-[3px]"
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
            boxShadow: i < filled ? "0 1px 3px #A77ACB44" : "none",
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
  compact = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "lavender" | "blush" | "cream";
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center justify-between gap-1">
          <span className="hud-label flex min-w-0 items-center gap-1 truncate">
            <Icon className="h-3 w-3 shrink-0" />
            {label}
          </span>
          <span className="hud-label shrink-0 text-[#A77ACB]">{Math.round(value)}%</span>
        </div>
        <CloudBar value={value} tone={tone} />
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-soft">
        <Icon className="h-3.5 w-3.5 text-[#A77ACB]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className="hud-label truncate">{label}</span>
          <span className="hud-label shrink-0 text-[#A77ACB]">{Math.round(value)}%</span>
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
    <div className="flex min-w-0 items-baseline justify-between gap-2 rounded-xl bg-white/80 px-2.5 py-1.5">
      <span className="hud-label flex min-w-0 items-center gap-1.5 truncate">
        {icon}
        {label}
      </span>
      <span className="hud-body min-w-0 truncate text-right font-semibold text-[#4D405E]">{value}</span>
    </div>
  );
}

export function useHudZoom() {
  const [zoom, setZoomState] = useState(1);
  const metrics = useRef<{ renderedHeight: number; viewportHeight: number } | null>(null);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(ZOOM_STORAGE_KEY));
    if (Number.isFinite(saved) && saved > 0) setZoomState(clampZoom(saved));
  }, []);

  const setZoom = useCallback((next: number) => {
    const clamped = clampZoom(next);
    setZoomState(clamped);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, String(clamped));
      document.documentElement.style.setProperty("--hud-zoom", String(clamped));
    }
    return clamped;
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--hud-zoom", String(zoom));
  }, [zoom]);

  const onMetrics = useCallback((next: { renderedHeight: number; viewportHeight: number }) => {
    metrics.current = next;
  }, []);

  const fit = useCallback(() => setZoom(1), [setZoom]);

  return { zoom, setZoom, onMetrics, fit };
}

export function DensityControls({
  zoom,
  setZoom,
}: {
  zoom: number;
  setZoom: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-white/80 p-0.5 shadow-soft">
      <button
        type="button"
        onClick={() => setZoom(zoom - ZOOM_STEP)}
        disabled={zoom <= MIN_ZOOM}
        aria-label="Smaller text"
        className="hud-icon-btn disabled:opacity-40"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setZoom(1)}
        aria-label="Reset text size"
        className="min-w-8 px-1 text-[10px] font-semibold text-[#A77ACB]"
      >
        {Math.round(zoom * 100)}
      </button>
      <button
        type="button"
        onClick={() => setZoom(zoom + ZOOM_STEP)}
        disabled={zoom >= MAX_ZOOM}
        aria-label="Larger text"
        className="hud-icon-btn disabled:opacity-40"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => setZoom(1)} aria-label="Fit screen" className="hud-icon-btn">
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
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
