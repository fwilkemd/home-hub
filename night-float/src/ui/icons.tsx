/**
 * Tiny inline SVG glyphs (no icon lib, ABSOLUTELY no emoji). All stroke/fill
 * currentColor so they inherit text color.
 */
interface IconProps {
  size?: number;
}

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
    focusable: false as const,
  };
}

/** Two vertical bars — pause. */
export function IconPause({ size = 11 }: IconProps) {
  return (
    <svg {...svgProps(size)} fill="currentColor">
      <rect x="5" y="4" width="5" height="16" rx="1.4" />
      <rect x="14" y="4" width="5" height="16" rx="1.4" />
    </svg>
  );
}

export function IconCheck({ size = 12 }: IconProps) {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 L9.5 18 L20 6" />
    </svg>
  );
}

export function IconX({ size = 12 }: IconProps) {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <path d="M5 5 L19 19 M19 5 L5 19" />
    </svg>
  );
}

/** Filled right-pointing triangle — active step. */
export function IconCaret({ size = 11 }: IconProps) {
  return (
    <svg {...svgProps(size)} fill="currentColor">
      <path d="M7 4 L19 12 L7 20 Z" />
    </svg>
  );
}

export function IconChevUp({ size = 13 }: IconProps) {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 15 L12 8 L19 15" />
    </svg>
  );
}

export function IconChevDown({ size = 13 }: IconProps) {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 9 L12 16 L19 9" />
    </svg>
  );
}

/** Small up arrow — high lab flag. */
export function IconArrowUp({ size = 10 }: IconProps) {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20 L12 5 M6 11 L12 5 L18 11" />
    </svg>
  );
}

/** Small down arrow — low lab flag. */
export function IconArrowDown({ size = 10 }: IconProps) {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4 L12 19 M6 13 L12 19 L18 13" />
    </svg>
  );
}

/** Speech bubble — chat launcher. */
export function IconChat({ size = 14 }: IconProps) {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-8 8H6l-3 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
    </svg>
  );
}
