export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function invLerp(a: number, b: number, v: number): number {
  return clamp((v - a) / (b - a), 0, 1);
}

export function remap(
  v: number,
  a0: number,
  b0: number,
  a1: number,
  b1: number
): number {
  return lerp(a1, b1, invLerp(a0, b0, v));
}
