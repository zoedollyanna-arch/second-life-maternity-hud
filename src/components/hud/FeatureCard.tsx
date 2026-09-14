export type FeatureTint = "lavender" | "blush" | "cream";

type FeatureCardProps = {
  label: string;
  icon: string;
  tint: FeatureTint;
  badge?: number;
  onSelect?: () => void;
};

const tiles: Record<FeatureCardProps["tint"], string> = {
  lavender: "from-lavender-soft via-pearl to-lavender-soft/70",
  blush: "from-blush-soft via-pearl to-blush-soft/70",
  cream: "from-cream via-pearl to-cream/70",
};

export function FeatureCard({ label, icon, tint, badge, onSelect }: FeatureCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-[0.3rem] transition-transform duration-200 hover:-translate-y-[2px] active:translate-y-0"
    >
      <span
        className={`hud-tile relative flex aspect-square min-h-0 flex-1 items-center justify-center rounded-[28%] bg-gradient-to-br ${tiles[tint]} p-[11%]`}
      >
        <img
          src={icon}
          alt=""
          loading="eager"
          width={512}
          height={512}
          className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(160,140,190,0.25)]"
        />
        {badge ? (
          <span className="absolute -right-[3%] -top-[3%] flex h-[1.7em] min-w-[1.7em] items-center justify-center rounded-full bg-gradient-to-br from-blush to-blush/80 px-1 text-[clamp(0.6rem,1.4vh,0.8rem)] font-bold text-pearl shadow-soft ring-2 ring-pearl">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="font-sans text-[clamp(0.8rem,2.1vh,1.15rem)] font-semibold leading-none text-foreground">
        {label}
      </span>
    </button>
  );
}
