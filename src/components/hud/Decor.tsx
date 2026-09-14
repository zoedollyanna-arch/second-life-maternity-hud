/** Decorative dreamy background: soft clouds + subtle sparkles. Purely visual. */

function Cloud({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden="true">
      <g fill="currentColor">
        <circle cx={38} cy={30} r={20} />
        <circle cx={64} cy={22} r={24} />
        <circle cx={88} cy={32} r={17} />
        <rect x={18} y={30} width={88} height={24} rx={12} />
      </g>
    </svg>
  );
}

function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 0c.8 6.4 4.8 10.4 12 12-7.2 1.6-11.2 5.6-12 12-.8-6.4-4.8-10.4-12-12C7.2 10.4 11.2 6.4 12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Decor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <Cloud className="cloud-drift cloud-drift-slow absolute -left-[4%] top-[1%] w-[26%] text-pearl/85 drop-shadow-sm" />
      <Cloud className="cloud-drift cloud-drift-reverse absolute left-[16%] top-[7%] w-[16%] text-pearl/60" />
      <Cloud className="cloud-drift cloud-drift-medium absolute -right-[3%] top-[2%] w-[24%] text-pearl/85 drop-shadow-sm" />
      <Cloud className="cloud-drift cloud-drift-reverse-slow absolute right-[18%] top-[8%] w-[14%] text-pearl/55" />
      <Cloud className="cloud-drift cloud-drift-medium absolute -left-[6%] bottom-[6%] w-[22%] text-pearl/35" />
      <Cloud className="cloud-drift cloud-drift-reverse absolute -right-[6%] bottom-[10%] w-[20%] text-pearl/35" />

      <Sparkle className="absolute left-[30%] top-[3%] w-[1.1%] text-blush/70" />
      <Sparkle className="absolute left-[42%] top-[10%] w-[0.8%] text-lavender/70" />
      <Sparkle className="absolute right-[31%] top-[5%] w-[1%] text-lavender/70" />
      <Sparkle className="absolute right-[42%] top-[11%] w-[0.7%] text-blush/70" />
      <Sparkle className="absolute left-[8%] top-[36%] w-[0.7%] text-lavender/50" />
      <Sparkle className="absolute right-[9%] top-[42%] w-[0.7%] text-blush/50" />
    </div>
  );
}
