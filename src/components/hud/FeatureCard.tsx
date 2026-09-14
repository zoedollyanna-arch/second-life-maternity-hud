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
    <button type="button" onClick={onSelect} className="hud-feature">
      <span className={`hud-tile hud-feature-face bg-gradient-to-br ${tiles[tint]}`}>
        <img
          src={icon}
          alt=""
          loading="eager"
          width={44}
          height={44}
          className="hud-feature-art"
        />
        {badge ? <span className="hud-feature-badge">{badge}</span> : null}
      </span>
      <span className="hud-feature-label">{label}</span>
    </button>
  );
}
