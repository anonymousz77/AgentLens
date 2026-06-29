import * as THREE from 'three';
import { SCORE_GREEN } from '../../lib/colors';
import type { EyeStateParams } from './types';

export const VERTEX_SHADER = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */`
precision highp float;

uniform float uTime;
uniform vec3  uEyeColor;
uniform float uBlink;
uniform float uAspect;

uniform float uHwFrom;
uniform float uHhFrom;
uniform float uRotFrom;
uniform float uModeFrom;
uniform float uSweepFrom;
uniform float uFlickerFrom;
uniform float uPulseFrom;
uniform float uBrightnessFrom;

uniform float uHwTo;
uniform float uHhTo;
uniform float uRotTo;
uniform float uModeTo;
uniform float uSweepTo;
uniform float uFlickerTo;
uniform float uPulseTo;
uniform float uBrightnessTo;

uniform float uStateBlend;

varying vec2 vUv;

// Approximate ellipse SDF via scaled-circle trick (valid for aspect ratios < 3:1)
float sdEllipseApprox(vec2 p, vec2 ab) {
  vec2 s = p / ab;
  float d = length(s) - 1.0;
  return d * min(ab.x, ab.y);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0);
}

float eyeGlow(float sdf) {
  return exp(-max(sdf, 0.0) * 12.0);
}

void main() {
  // Centred, aspect-corrected UV space (uAspect ≈ 1.40 for the spherical patch)
  vec2 p = (vUv - 0.5) * 2.0;
  p.x *= uAspect;

  // Blend all shape parameters from→to
  float hw    = mix(uHwFrom,         uHwTo,         uStateBlend);
  float hh    = mix(uHhFrom,         uHhTo,         uStateBlend);
  float rot   = mix(uRotFrom,        uRotTo,        uStateBlend);
  float mode  = mix(uModeFrom,       uModeTo,       uStateBlend);
  float sweep = mix(uSweepFrom,      uSweepTo,      uStateBlend);
  float flick = mix(uFlickerFrom,    uFlickerTo,    uStateBlend);
  float pulse = mix(uPulseFrom,      uPulseTo,      uStateBlend);
  float brite = mix(uBrightnessFrom, uBrightnessTo, uStateBlend);

  // Idle size pulse
  float pulseMult = 1.0 + pulse * sin(uTime * 3.14159265);
  hw *= pulseMult;
  hh *= pulseMult;

  // Eye centres in aspect-corrected space
  vec2 leftCenter  = vec2(-0.45, 0.0);
  vec2 rightCenter = vec2( 0.45, 0.0);

  float cosR = cos(rot);
  float sinR = sin(rot);

  // Left eye: CW coord rotation → shape appears CCW-rotated → inner (right) corner rises
  // for concerned state (rot ≈ 0.18 rad)
  vec2 pL = p - leftCenter;
  pL = vec2(cosR * pL.x + sinR * pL.y, -sinR * pL.x + cosR * pL.y);

  // Right eye: CCW coord rotation → shape appears CW-rotated → inner (left) corner rises
  vec2 pR = p - rightCenter;
  pR = vec2(cosR * pR.x - sinR * pR.y,  sinR * pR.x + cosR * pR.y);

  // Scanning sweep offset (applies only when sweep > 0)
  float sweepX = sin(uTime * 5.0) * 0.2 * sweep;
  vec2 pLs = pL - vec2(sweepX, 0.0);
  vec2 pRs = pR - vec2(sweepX, 0.0);

  // SDF mode 0: rounded ellipse
  float sdfL_e = sdEllipseApprox(pL, vec2(hw, hh));
  float sdfR_e = sdEllipseApprox(pR, vec2(hw, hh));

  // SDF mode 1: axis-aligned box slit (with sweep), narrow hh from state params
  float sdfL_b = sdBox(pLs, vec2(hw, hh));
  float sdfR_b = sdBox(pRs, vec2(hw, hh));

  // SDF mode 2: upper-arc crescent (lower half of ring = concave-up = happy squint)
  float arcR  = 0.11;
  float arcTh = 0.025;
  float sdfL_a = max(abs(length(pL) - arcR) - arcTh, pL.y);
  float sdfR_a = max(abs(length(pR) - arcR) - arcTh, pR.y);

  // Blend: 0→1 = ellipse→box, 1→2 = box→arc
  float t01 = clamp(mode, 0.0, 1.0);
  float t12 = clamp(mode - 1.0, 0.0, 1.0);
  float sdfL = mix(mix(sdfL_e, sdfL_b, t01), sdfL_a, t12);
  float sdfR = mix(mix(sdfR_e, sdfR_b, t01), sdfR_a, t12);

  // Glow
  float glowL = eyeGlow(sdfL);
  float glowR = eyeGlow(sdfR);

  // Flicker (pseudo-random; concerned state uses flick > 0)
  float flickerNoise = fract(sin(uTime * 127.3 + 4.1) * 43758.5453);
  float flickerMult  = 1.0 - flick * flickerNoise * 0.4;

  // Blink fades the glow to black (brightness fade, not shape squish)
  float blinkFade = 1.0 - uBlink;

  float total = clamp((glowL + glowR) * brite * flickerMult * blinkFade, 0.0, 1.0);
  gl_FragColor = vec4(uEyeColor * total, 1.0);
}
`;

type Uniform<T> = { value: T };

export interface EyeUniforms {
  uTime:           Uniform<number>;
  uEyeColor:       Uniform<THREE.Vector3>;
  uBlink:          Uniform<number>;
  uAspect:         Uniform<number>;
  uHwFrom:         Uniform<number>;
  uHhFrom:         Uniform<number>;
  uRotFrom:        Uniform<number>;
  uModeFrom:       Uniform<number>;
  uSweepFrom:      Uniform<number>;
  uFlickerFrom:    Uniform<number>;
  uPulseFrom:      Uniform<number>;
  uBrightnessFrom: Uniform<number>;
  uHwTo:           Uniform<number>;
  uHhTo:           Uniform<number>;
  uRotTo:          Uniform<number>;
  uModeTo:         Uniform<number>;
  uSweepTo:        Uniform<number>;
  uFlickerTo:      Uniform<number>;
  uPulseTo:        Uniform<number>;
  uBrightnessTo:   Uniform<number>;
  uStateBlend:     Uniform<number>;
}

// State parameters for each emote — order matches EMOTE_INDEX
export const STATE_PARAMS: EyeStateParams[] = [
  // 0 — calm: soft pulse, regular blink
  { hw: 0.25, hh: 0.155, rot: 0.00, mode: 0.0, sweep: 0.0, flicker: 0.00, pulse: 0.030, brightness: 1.00, blinkInterval: 5.0 },
  // 1 — curious: wider eyes, faster pulse
  { hw: 0.28, hh: 0.190, rot: 0.00, mode: 0.0, sweep: 0.0, flicker: 0.00, pulse: 0.015, brightness: 1.10, blinkInterval: 3.5 },
  // 2 — scanning: narrow slit with sweep animation, no blink
  { hw: 0.28, hh: 0.052, rot: 0.00, mode: 1.0, sweep: 1.0, flicker: 0.00, pulse: 0.000, brightness: 1.20, blinkInterval: 999.0 },
  // 3 — concerned: inner corners raised (rot), subtle flicker
  { hw: 0.23, hh: 0.138, rot: 0.18, mode: 0.0, sweep: 0.0, flicker: 0.08, pulse: 0.020, brightness: 0.85, blinkInterval: 4.0 },
  // 4 — happy: arc crescent (mode 2), bright, slow blink
  { hw: 0.25, hh: 0.155, rot: 0.00, mode: 2.0, sweep: 0.0, flicker: 0.00, pulse: 0.040, brightness: 1.30, blinkInterval: 6.0 },
];

export function createEyeUniforms(): EyeUniforms {
  // Initialize both From and To to calm state so the first frame is correct
  return {
    uTime:           { value: 0 },
    uEyeColor:       { value: new THREE.Vector3(SCORE_GREEN.r / 255, SCORE_GREEN.g / 255, SCORE_GREEN.b / 255) },
    uBlink:          { value: 0 },
    uAspect:         { value: 1.40 }, // approximate; tuned visually during verification
    uHwFrom:         { value: 0.25 },
    uHhFrom:         { value: 0.155 },
    uRotFrom:        { value: 0.00 },
    uModeFrom:       { value: 0.0 },
    uSweepFrom:      { value: 0.0 },
    uFlickerFrom:    { value: 0.00 },
    uPulseFrom:      { value: 0.030 },
    uBrightnessFrom: { value: 1.00 },
    uHwTo:           { value: 0.25 },
    uHhTo:           { value: 0.155 },
    uRotTo:          { value: 0.00 },
    uModeTo:         { value: 0.0 },
    uSweepTo:        { value: 0.0 },
    uFlickerTo:      { value: 0.00 },
    uPulseTo:        { value: 0.030 },
    uBrightnessTo:   { value: 1.00 },
    uStateBlend:     { value: 1.0 },
  };
}
