import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";

export const HUD_DESIGN_WIDTH = 1280;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.75;
export const ZOOM_STEP = 0.1;
export const ZOOM_STORAGE_KEY = "nestoriaHudZoomV3";

export const clampZoom = (value: number) =>
  Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)) * 100) / 100;

export function CloudBar({
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

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[20px] bg-card/85 backdrop-blur-xl shadow-cloud ring-1 ring-white/60 p-4 lg:p-5 ${className}`}
    >
      {children}
    </div>
  );
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
      className="mt-5 w-full rounded-full py-2.5 font-medium text-white shadow-soft transition hover:brightness-105 disabled:opacity-60"
      style={{ background: "var(--gradient-lavender)" }}
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
    <div className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2">
      <span className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function ScaledFrame({
  zoom,
  onMetrics,
  children,
}: {
  zoom: number;
  onMetrics?: (metrics: { renderedHeight: number; viewportHeight: number }) => void;
  children: ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => setAvailableWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const sync = () => setContentHeight(el.offsetHeight);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scaled = availableWidth !== null && availableWidth > 0;
  const fitScale = scaled ? Math.min(1, availableWidth / HUD_DESIGN_WIDTH) : 1;
  const scale = fitScale * zoom;

  useEffect(() => {
    if (!onMetrics || contentHeight === null || !scaled) return;
    onMetrics({
      renderedHeight: contentHeight * scale,
      viewportHeight: window.innerHeight,
    });
  }, [onMetrics, contentHeight, scale, scaled]);

  return (
    <div
      ref={outerRef}
      style={{
        height: scaled && contentHeight !== null ? contentHeight * scale : undefined,
        overflow: "hidden",
      }}
    >
      <div
        ref={innerRef}
        className="@container"
        style={
          scaled
            ? {
                width: availableWidth / scale,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

function ZoomControls({
  zoom,
  onZoom,
  onReset,
  onFit,
}: {
  zoom: number;
  onZoom: (next: number) => void;
  onReset: () => void;
  onFit: () => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full bg-card/90 backdrop-blur-md px-2 py-1.5 shadow-cloud ring-1 ring-white/60">
      <button
        onClick={() => onZoom(zoom - ZOOM_STEP)}
        disabled={zoom <= MIN_ZOOM}
        aria-label="Zoom out"
        title="Zoom out"
        className="h-9 w-9 rounded-full bg-white/70 flex items-center justify-center shadow-soft hover:bg-white transition disabled:opacity-40"
      >
        <ZoomOut className="h-4 w-4 text-[color:var(--lavender-deep)]" />
      </button>
      <button
        onClick={onReset}
        aria-label="Reset zoom to 100%"
        title="Reset zoom to 100%"
        className="min-w-14 rounded-full px-2 py-1 text-xs font-semibold text-[color:var(--lavender-deep)] hover:bg-white/70 transition"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={() => onZoom(zoom + ZOOM_STEP)}
        disabled={zoom >= MAX_ZOOM}
        aria-label="Zoom in"
        title="Zoom in"
        className="h-9 w-9 rounded-full bg-white/70 flex items-center justify-center shadow-soft hover:bg-white transition disabled:opacity-40"
      >
        <ZoomIn className="h-4 w-4 text-[color:var(--lavender-deep)]" />
      </button>
      <button
        onClick={onFit}
        aria-label="Fit the whole screen"
        title="Fit the whole screen"
        className="h-9 w-9 rounded-full bg-white/70 flex items-center justify-center shadow-soft hover:bg-white transition"
      >
        <Maximize2 className="h-4 w-4 text-[color:var(--lavender-deep)]" />
      </button>
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
    }
    return clamped;
  }, []);

  const onMetrics = useCallback((next: { renderedHeight: number; viewportHeight: number }) => {
    metrics.current = next;
  }, []);

  const fit = useCallback(() => {
    const current = metrics.current;
    if (!current || current.renderedHeight <= 0) return setZoom(1);
    if (current.renderedHeight <= current.viewportHeight) return setZoom(1);
    return setZoom((zoom * current.viewportHeight) / current.renderedHeight);
  }, [setZoom, zoom]);

  return { zoom, setZoom, onMetrics, fit };
}

export function HudFrame({
  zoom,
  setZoom,
  onMetrics,
  fit,
  children,
}: ReturnType<typeof useHudZoom> & { children: ReactNode }) {
  return (
    <>
      <ScaledFrame zoom={zoom} onMetrics={onMetrics}>
        {children}
      </ScaledFrame>
      <ZoomControls zoom={zoom} onZoom={setZoom} onReset={() => setZoom(1)} onFit={fit} />
    </>
  );
}

export function Ambient() {
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

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full">
      <Ambient />
      {children}
    </div>
  );
}
