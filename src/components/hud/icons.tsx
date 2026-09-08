/**
 * Nestoria home-screen icons.
 *
 * Drawn as SVG rather than imported art, for three reasons:
 *
 *   1. The client's mockup uses bespoke soft illustrations — a pregnant
 *      silhouette on a cloud, a vitamin bottle, a sleeping baby. No general
 *      icon set contains those, so a pack would get close and never identical.
 *   2. This HUD is going to be sold. Third-party art needs a licence that
 *      permits redistribution inside a commercial product, and "I bought it"
 *      is not that licence. Original vectors have no such question.
 *   3. They render on a Second Life shared-media face. Inline SVG costs no
 *      extra requests and stays crisp at whatever size the tablet lands on.
 *
 * The soft-3D look comes from three layers on every shape, which is what a flat
 * fill was missing: a radial gradient lit from the top left, a blurred contact
 * shadow beneath, and a blurred white catchlight on top. The gradients and
 * filters live in <HudIconDefs />, rendered once per document — SVG resolves
 * url(#id) across the whole page, so defining them per icon would mean dozens
 * of duplicate ids silently cross-wiring.
 */

export interface HudIconProps {
  className?: string;
}

/**
 * Shared gradients and filters. Render exactly once, near the root.
 * Hidden rather than display:none — Safari drops filter lookups on a
 * display:none subtree.
 */
export function HudIconDefs() {
  return (
    <svg
      aria-hidden
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {/* Volumetric fills: highlight, body, core shadow. */}
        <radialGradient id="nv-lav" cx="32%" cy="24%" r="82%">
          <stop offset="0%" stopColor="#E4D5F2" />
          <stop offset="42%" stopColor="#BE9BDD" />
          <stop offset="100%" stopColor="#8E63B5" />
        </radialGradient>
        <radialGradient id="nv-lav-soft" cx="32%" cy="24%" r="82%">
          <stop offset="0%" stopColor="#FBF7FE" />
          <stop offset="45%" stopColor="#DFCFF0" />
          <stop offset="100%" stopColor="#BC9BD8" />
        </radialGradient>
        <radialGradient id="nv-pink" cx="32%" cy="24%" r="82%">
          <stop offset="0%" stopColor="#FFEAF1" />
          <stop offset="42%" stopColor="#F3B9CB" />
          <stop offset="100%" stopColor="#DE8FA8" />
        </radialGradient>
        <radialGradient id="nv-pink-soft" cx="32%" cy="24%" r="82%">
          <stop offset="0%" stopColor="#FFF8FB" />
          <stop offset="48%" stopColor="#FBDDE7" />
          <stop offset="100%" stopColor="#EFB4C7" />
        </radialGradient>
        <radialGradient id="nv-cream" cx="32%" cy="24%" r="82%">
          <stop offset="0%" stopColor="#FFFCF4" />
          <stop offset="45%" stopColor="#FBE7C4" />
          <stop offset="100%" stopColor="#E8C795" />
        </radialGradient>
        {/* Clouds: white, but shaded so they read as volume not paper. */}
        <radialGradient id="nv-cloud" cx="34%" cy="22%" r="86%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="58%" stopColor="#FBF7FE" />
          <stop offset="100%" stopColor="#E6DCF2" />
        </radialGradient>
        {/* Meter pips. Same volumetric idea at a much smaller size, so the
            highlight sits higher and the ramp is shorter. */}
        <radialGradient id="nv-pip-lavender" cx="34%" cy="20%" r="86%">
          <stop offset="0%" stopColor="#D9C4EC" />
          <stop offset="45%" stopColor="#B48FD6" />
          <stop offset="100%" stopColor="#8E63B5" />
        </radialGradient>
        <radialGradient id="nv-pip-blush" cx="34%" cy="20%" r="86%">
          <stop offset="0%" stopColor="#FBD9E4" />
          <stop offset="45%" stopColor="#F0AEC3" />
          <stop offset="100%" stopColor="#DB88A3" />
        </radialGradient>
        <radialGradient id="nv-pip-cream" cx="34%" cy="20%" r="86%">
          <stop offset="0%" stopColor="#FBEED6" />
          <stop offset="45%" stopColor="#EFD3A2" />
          <stop offset="100%" stopColor="#DDB878" />
        </radialGradient>
        <radialGradient id="nv-pip-sky" cx="34%" cy="20%" r="86%">
          <stop offset="0%" stopColor="#CFDFF4" />
          <stop offset="45%" stopColor="#8FAEDA" />
          <stop offset="100%" stopColor="#6683B8" />
        </radialGradient>
        <radialGradient id="nv-pip-empty" cx="34%" cy="20%" r="86%">
          <stop offset="0%" stopColor="#FAF7FC" />
          <stop offset="55%" stopColor="#EDE7F3" />
          <stop offset="100%" stopColor="#DCD3E6" />
        </radialGradient>
        <filter id="nv-pip-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="0.8"
            stdDeviation="0.7"
            floodColor="#5B4477"
            floodOpacity="0.3"
          />
        </filter>

        <linearGradient id="nv-page" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FBEAF1" />
        </linearGradient>

        {/* Soft contact shadow, used under the main mass of each icon. */}
        <filter id="nv-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="1.6"
            stdDeviation="1.5"
            floodColor="#5B4477"
            floodOpacity="0.28"
          />
        </filter>
        <filter id="nv-shadow-lg" x="-45%" y="-45%" width="190%" height="190%">
          <feDropShadow
            dx="0"
            dy="2.4"
            stdDeviation="2.4"
            floodColor="#5B4477"
            floodOpacity="0.26"
          />
        </filter>
        {/* Blur for the catchlights, so a highlight melts instead of stamping. */}
        <filter id="nv-soften" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.1" />
        </filter>
        <filter id="nv-soften-sm" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>
    </svg>
  );
}

function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      {children}
    </svg>
  );
}

/** Blurred white catchlight. The thing that makes a shape look lit. */
function Gleam({
  cx,
  cy,
  rx,
  ry,
  o = 0.75,
  rotate,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  o?: number;
  rotate?: number;
}) {
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      fill="#FFFFFF"
      opacity={o}
      filter="url(#nv-soften-sm)"
      transform={rotate ? `rotate(${rotate} ${cx} ${cy})` : undefined}
    />
  );
}

function Cloud({ y = 47, fill = "url(#nv-cloud)" }: { y?: number; fill?: string }) {
  return (
    <g fill={fill} filter="url(#nv-shadow)">
      <circle cx="20" cy={y} r="8.4" />
      <circle cx="32" cy={y - 3.4} r="10.4" />
      <circle cx="44" cy={y} r="7.8" />
      <rect x="11.6" y={y} width="40.8" height="9.4" rx="4.7" />
    </g>
  );
}

function Heart({
  x,
  y,
  s,
  fill,
  shadow,
}: {
  x: number;
  y: number;
  s: number;
  fill: string;
  shadow?: boolean;
}) {
  return (
    <path
      filter={shadow ? "url(#nv-shadow)" : undefined}
      fill={fill}
      d={`M ${x} ${y + s * 0.74}
          C ${x - s * 1.28} ${y - s * 0.08} ${x - s * 0.56} ${y - s * 1.08} ${x} ${y - s * 0.3}
          C ${x + s * 0.56} ${y - s * 1.08} ${x + s * 1.28} ${y - s * 0.08} ${x} ${y + s * 0.74} Z`}
    />
  );
}

// ---------------------------------------------------------------------------

export function PregnancyIcon({ className }: HudIconProps) {
  return (
    <Svg className={className}>
      <Cloud y={49} />
      <g filter="url(#nv-shadow-lg)">
        <circle cx="26.5" cy="15.5" r="6.8" fill="url(#nv-lav)" />
        <path
          fill="url(#nv-lav)"
          d="M24.6 21.4c-4.7 0-8.2 3.5-8.8 8-.5 3.7-.9 6.4-1.4 9.9-.4 2.9.6 5.3 2.3 7.8h6.4c-1.5-3.1-1.9-5.5-1.5-8.4.2-1.7.6-3.7 1-5.6 2.7 1 5.2 2.7 7 5.1 2 2.7 2.7 5.8 2 8.9h6.8c1-4.9-.2-9.9-3.5-13.8-2.7-3.3-6.2-5.3-9.9-6.2l.6-5.7Z"
        />
      </g>
      <Gleam cx={24.5} cy={13} rx={2.6} ry={2} />
      <Gleam cx={20} cy={30} rx={1.9} ry={4.4} o={0.5} rotate={-14} />
      <Heart x={45} y={21} s={4.8} fill="url(#nv-pink)" shadow />
      <Heart x={52} y={31} s={3.2} fill="url(#nv-pink-soft)" />
    </Svg>
  );
}

export function HealthIcon({ className }: HudIconProps) {
  return (
    <Svg className={className}>
      <g fill="url(#nv-cloud)" filter="url(#nv-shadow-lg)">
        <circle cx="21" cy="34" r="11.4" />
        <circle cx="34" cy="27.5" r="14.4" />
        <circle cx="46.5" cy="35" r="10.4" />
        <rect x="11.6" y="34" width="42.8" height="13.4" rx="6.7" />
      </g>
      <Gleam cx={26} cy={20} rx={7} ry={3.6} o={0.9} rotate={-18} />
      <path
        d="M15 37h7.6l4-8.6 5 15.4 4-9.2 3 4.4h10"
        fill="none"
        stroke="#A77ACB"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#nv-shadow)"
      />
      <Heart x={45} y={20} s={5.6} fill="url(#nv-lav)" shadow />
      <Gleam cx={43} cy={17.5} rx={1.7} ry={1.3} />
    </Svg>
  );
}

export function CareIcon({ className }: HudIconProps) {
  return (
    <Svg className={className}>
      <Cloud y={50} />
      <g filter="url(#nv-shadow-lg)">
        <rect x="19.5" y="9" width="19" height="8.6" rx="3.4" fill="url(#nv-pink)" />
        <rect x="17" y="16.4" width="24" height="31" rx="7.4" fill="url(#nv-lav-soft)" />
      </g>
      <Gleam cx={22.5} cy={24} rx={2.4} ry={6.4} o={0.85} />
      <Gleam cx={23} cy={11.6} rx={3.4} ry={1.5} />
      <Heart x={29} y={33} s={5.8} fill="url(#nv-lav)" />
      <g filter="url(#nv-shadow)">
        <ellipse cx="48.5" cy="42" rx="7.8" ry="7.2" fill="url(#nv-lav-soft)" />
      </g>
      <path d="M41 42h15" stroke="#C4A7DE" strokeWidth="1.7" strokeLinecap="round" />
      <Gleam cx={46} cy={39} rx={2.6} ry={1.6} />
    </Svg>
  );
}

export function PartnerIcon({ className }: HudIconProps) {
  return (
    <Svg className={className}>
      <Heart x={24} y={30} s={15.5} fill="url(#nv-lav)" shadow />
      <Heart x={40} y={34} s={14.5} fill="url(#nv-pink)" shadow />
      <Gleam cx={18} cy={21} rx={4} ry={2.6} o={0.8} rotate={-30} />
      <Gleam cx={35} cy={26} rx={3.4} ry={2.2} o={0.75} rotate={-30} />
    </Svg>
  );
}

export function JournalIcon({ className }: HudIconProps) {
  return (
    <Svg className={className}>
      <g filter="url(#nv-shadow-lg)">
        <path
          d="M32 20.5c-5.2-4.2-12.4-5.7-19.6-4.6v29.6c7.2-1 14.4.4 19.6 4.5V20.5Z"
          fill="url(#nv-page)"
        />
        <path
          d="M32 20.5c5.2-4.2 12.4-5.7 19.6-4.6v29.6c-7.2-1-14.4.4-19.6 4.5V20.5Z"
          fill="url(#nv-page)"
        />
      </g>
      <path d="M32 20.5v29.5" stroke="#EFC3D3" strokeWidth="1.5" />
      <path
        d="M17.5 25.5h9M17.5 31.5h9M37.5 25.5h9M37.5 31.5h9"
        stroke="#F0C7D6"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <Gleam cx={22} cy={22} rx={5} ry={2} o={0.85} rotate={-10} />
      <Heart x={32} y={37} s={5.4} fill="url(#nv-pink)" shadow />
      <g transform="rotate(38 48 40)" filter="url(#nv-shadow)">
        <rect x="45" y="23" width="5.4" height="21" rx="2.4" fill="url(#nv-lav)" />
        <path d="M45 44h5.4l-2.7 5.2L45 44Z" fill="#7E549F" />
      </g>
    </Svg>
  );
}

export function BabyIcon({ className }: HudIconProps) {
  return (
    <Svg className={className}>
      <Cloud y={46} />
      <g filter="url(#nv-shadow-lg)">
        <ellipse cx="32" cy="27.5" rx="13.4" ry="12.4" fill="url(#nv-pink-soft)" />
      </g>
      <Gleam cx={26} cy={20.5} rx={5.2} ry={3} o={0.9} rotate={-18} />
      <path
        d="M24.8 27q2.5 2.5 5 0M34.2 27q2.5 2.5 5 0"
        stroke="#D98BA5"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="23" cy="31.6" r="2.7" fill="#F5B7C9" opacity="0.8" />
      <circle cx="41" cy="31.6" r="2.7" fill="#F5B7C9" opacity="0.8" />
      <path
        d="M29.6 16.4q3.2-4.2 6.4-.7"
        stroke="#DE8FA8"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      <Heart x={48} y={16} s={3.8} fill="url(#nv-pink)" />
      <Heart x={15.5} y={19} s={3} fill="url(#nv-pink-soft)" />
    </Svg>
  );
}

export function NotificationsIcon({ className }: HudIconProps) {
  return (
    <Svg className={className}>
      <g filter="url(#nv-shadow-lg)">
        <path
          fill="url(#nv-lav)"
          d="M32 10.5a4.2 4.2 0 0 1 4.2 4.2v1.1c6.6 1.9 11 7.9 11 15v8.1l3.5 5.6c.9 1.4-.1 3.2-1.8 3.2H15.1c-1.7 0-2.7-1.8-1.8-3.2l3.5-5.6v-8.1c0-7.1 4.4-13.1 11-15v-1.1a4.2 4.2 0 0 1 4.2-4.2Z"
        />
        <path d="M25.8 50.3a6.2 6.2 0 0 0 12.4 0Z" fill="#7E549F" />
      </g>
      <Gleam cx={24} cy={24} rx={3.2} ry={7.4} o={0.55} rotate={10} />
      <g filter="url(#nv-shadow)">
        <circle cx="47.5" cy="16.5" r="9.8" fill="url(#nv-pink)" />
      </g>
      <Heart x={47.5} y={16.5} s={4.4} fill="#FFFFFF" />
      <Gleam cx={44} cy={13} rx={2.4} ry={1.7} />
    </Svg>
  );
}

export function SettingsIcon({ className }: HudIconProps) {
  const teeth = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <Svg className={className}>
      <g fill="url(#nv-lav)" filter="url(#nv-shadow-lg)">
        {teeth.map((deg) => (
          <rect
            key={deg}
            x="27.6"
            y="3.4"
            width="8.8"
            height="13.6"
            rx="3.8"
            transform={`rotate(${deg} 32 32)`}
          />
        ))}
        <circle cx="32" cy="32" r="19.4" />
      </g>
      <circle cx="32" cy="32" r="8.8" fill="#FBF7FE" />
      <circle cx="32" cy="32" r="8.8" fill="none" stroke="#B694D4" strokeWidth="1.2" />
      <Gleam cx={22} cy={22} rx={5.4} ry={3} o={0.6} rotate={-40} />
    </Svg>
  );
}

export function HospitalBagIcon({ className }: HudIconProps) {
  return (
    <Svg className={className}>
      <path
        d="M25 20v-3.2a7 7 0 0 1 14 0V20"
        fill="none"
        stroke="#A77ACB"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <g filter="url(#nv-shadow-lg)">
        <rect x="12.6" y="19.6" width="38.8" height="28.8" rx="7.4" fill="url(#nv-lav-soft)" />
      </g>
      <Gleam cx={20} cy={26} rx={5} ry={2.4} o={0.8} rotate={-12} />
      <rect x="26.8" y="27" width="10.4" height="14" rx="3.2" fill="#FFFFFF" />
      <path d="M32 30v8M28 34h8" stroke="#E8A8BC" strokeWidth="2.8" strokeLinecap="round" />
    </Svg>
  );
}

export function MilestonesIcon({ className }: HudIconProps) {
  return (
    <Svg className={className}>
      <g filter="url(#nv-shadow-lg)">
        <path d="M20 12.6h24v11.4a12 12 0 0 1-24 0V12.6Z" fill="url(#nv-cream)" />
        <rect x="27.8" y="35" width="8.4" height="9.2" rx="2.2" fill="#E8C795" />
        <rect x="19.6" y="43.8" width="24.8" height="7.4" rx="3.4" fill="url(#nv-lav)" />
      </g>
      <path
        d="M20 16h-5.2a7.2 7.2 0 0 0 7.2 7.2M44 16h5.2a7.2 7.2 0 0 1-7.2 7.2"
        fill="none"
        stroke="#E8C795"
        strokeWidth="3.3"
        strokeLinecap="round"
      />
      <Gleam cx={26} cy={17} rx={3} ry={4} o={0.7} rotate={-16} />
      <Heart x={32} y={21} s={5.2} fill="url(#nv-pink)" />
    </Svg>
  );
}

/** Decorative cloud behind the wordmark. */
export function DecorCloud({ className }: HudIconProps) {
  return (
    <svg viewBox="0 0 120 56" className={className} aria-hidden focusable="false">
      <g fill="url(#nv-cloud)">
        <circle cx="30" cy="34" r="17" />
        <circle cx="56" cy="25" r="22" />
        <circle cx="84" cy="34" r="16" />
        <rect x="16" y="33" width="86" height="20" rx="10" />
      </g>
      <ellipse
        cx="46"
        cy="14"
        rx="14"
        ry="5"
        fill="#FFFFFF"
        opacity="0.9"
        filter="url(#nv-soften)"
      />
    </svg>
  );
}
