import { useId } from "react";
import type { LucideIcon } from "lucide-react";

type StatMeterProps = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "lavender" | "blush";
};

const CLOUDS = 5;
const CW = 46;
const GAP = 3;
const CH = 28;
const W = CLOUDS * CW + (CLOUDS - 1) * GAP;

function Cloud({ x, fill, stroke }: { x: number; fill: string; stroke: string }) {
  return (
    <g transform={`translate(${x},0)`} fill={fill} stroke={stroke} strokeWidth={1.1}>
      <circle cx={13} cy={15} r={8.5} />
      <circle cx={25} cy={11} r={10} />
      <circle cx={35} cy={16} r={7.5} />
      <rect x={4} y={15} width={38} height={11} rx={5.5} />
    </g>
  );
}

function CloudRow({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      {Array.from({ length: CLOUDS }, (_, i) => (
        <Cloud key={i} x={i * (CW + GAP)} fill={fill} stroke={stroke} />
      ))}
    </>
  );
}

export function StatMeter({ label, value, icon: Icon, tone }: StatMeterProps) {
  const clipId = useId();
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const fill = tone === "lavender" ? "var(--lavender)" : "var(--blush)";

  return (
    <div className="hud-stat-meter">
      <span className="hud-stat-icon">
        <Icon />
      </span>
      <span className="hud-stat-label">{label}</span>
      <svg
        viewBox={`0 0 ${W} ${CH}`}
        preserveAspectRatio="xMidYMid meet"
        className="hud-stat-clouds"
        role="img"
        aria-label={`${label}: ${pct}%`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={(W * pct) / 100} height={CH} />
          </clipPath>
        </defs>
        <CloudRow fill="#FFFFFF" stroke="var(--mist)" />
        <g clipPath={`url(#${clipId})`}>
          <CloudRow fill={fill} stroke={fill} />
        </g>
      </svg>
      <span className="hud-stat-pct">{pct}%</span>
    </div>
  );
}
