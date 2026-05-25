import { lerp } from './lerp';

// Single source of truth for the score color stops.
// tailwind.config.ts and globals.css both derive from these constants.
export const SCORE_GREEN = { r: 34,  g: 197, b: 94  } as const; // #22c55e
export const SCORE_AMBER = { r: 245, g: 158, b: 11  } as const; // #f59e0b
export const SCORE_RED   = { r: 239, g: 68,  b: 68  } as const; // #ef4444

type RGB = { r: number; g: number; b: number };

// Interpolates green→amber (p ∈ [0, 0.5]) then amber→red (p ∈ [0.5, 1]).
// Both getObserverColorHex and any Three.js consumer use this same helper
// so the DOM color and the mesh color can never disagree.
function interpolateStops(p: number): RGB {
  const isFirstHalf = p <= 0.5;
  const a: RGB = isFirstHalf ? SCORE_GREEN : SCORE_AMBER;
  const b: RGB = isFirstHalf ? SCORE_AMBER : SCORE_RED;
  const t = isFirstHalf ? p / 0.5 : (p - 0.5) / 0.5;
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

// Returns an rgb() string — safe to use in DOM inline styles and also
// in THREE.Material.color.setStyle() so Three.js is never imported here.
export function getObserverColorHex(p: number): string {
  const { r, g, b } = interpolateStops(p);
  return `rgb(${r},${g},${b})`;
}
