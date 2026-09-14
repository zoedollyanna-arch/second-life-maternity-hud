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
    <nav className="hud-panel hud-dock" aria-label="Primary">
      {items.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`hud-dock-btn ${isActive ? "is-active hud-dock-active" : ""}`}
          >
            <Icon />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
