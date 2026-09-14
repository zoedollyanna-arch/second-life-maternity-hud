import type { ComponentType } from "react";

export type BottomNavItem = {
  id: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

export function BottomNav({
  items,
  active,
  onSelect,
}: {
  items: BottomNavItem[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      className="hud-panel relative z-10 flex shrink-0 items-stretch gap-[0.4rem] rounded-full p-[0.35rem]"
      aria-label="Primary"
    >
      {items.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`flex flex-1 flex-col items-center justify-center gap-[0.15rem] rounded-full py-[0.35rem] transition-all duration-200 ${
              isActive
                ? "hud-dock-active bg-gradient-to-b from-lavender-soft via-lavender to-lavender text-primary-foreground shadow-soft ring-1 ring-pearl/70"
                : "text-muted-foreground hover:bg-pearl/70"
            }`}
          >
            <Icon className="h-[clamp(0.9rem,2.4vh,1.3rem)] w-[clamp(0.9rem,2.4vh,1.3rem)]" />
            <span className="text-[clamp(0.65rem,1.7vh,0.85rem)] font-semibold leading-none">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
