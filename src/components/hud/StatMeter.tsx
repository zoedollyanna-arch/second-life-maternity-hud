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
    <div className="flex items-center gap-[0.5rem]">
      <span className="grid h-[clamp(1.3rem,3.2vh,1.9rem)] w-[clamp(1.3rem,3.2vh,1.9rem)] shrink-0 place-items-center rounded-full bg-mist text-primary">
        <Icon className="h-[60%] w-[60%]" />
      </span>
      <span className="w-[clamp(3.4rem,9%,5rem)] shrink-0 text-[clamp(0.72rem,1.9vh,0.95rem)] font-semibold">
        {label}
      </span>
      <svg
        viewBox={`0 0 ${W} ${CH}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-[clamp(1.1rem,3.6vh,1.9rem)] min-w-0 flex-1"
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
      <span className="w-[3ch] shrink-0 text-right text-[clamp(0.72rem,1.9vh,0.95rem)] font-bold tabular-nums">
        {pct}%
      </span>
    </div>
  );
}
