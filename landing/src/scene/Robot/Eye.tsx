import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  VERTEX_SHADER,
  FRAGMENT_SHADER,
  createEyeUniforms,
  STATE_PARAMS,
  type EyeUniforms,
} from './eyeShader';
import { type EmoteState, EMOTE_INDEX } from './types';
import { clamp } from '../../lib/lerp';
import { prefersReducedMotion } from '../../lib/prefersReducedMotion';

interface EyeProps {
  emote?: EmoteState;
  phiSeg: number;
  thetaSeg: number;
}

// Safe accessor: STATE_PARAMS always has 5 elements; literal indices avoid noUncheckedIndexedAccess
function getStateParams(idx: number) {
  if (idx === 1) return STATE_PARAMS[1]!;
  if (idx === 2) return STATE_PARAMS[2]!;
  if (idx === 3) return STATE_PARAMS[3]!;
  if (idx === 4) return STATE_PARAMS[4]!;
  return STATE_PARAMS[0]!;
}

const BLEND_DURATION = 0.8;
const DEMO_DWELL     = 3.0;
const BLINK_DURATION = 0.18;

// Curved spherical patch parameters — must match visor in Robot.tsx
const PHI_START    = -Math.PI * 0.35;
const PHI_LENGTH   =  Math.PI * 0.70;
const THETA_START  =  Math.PI * 0.37;
const THETA_LENGTH =  Math.PI * 0.26;

export function Eye({ emote, phiSeg, thetaSeg }: EyeProps) {
  // Keep a fully-typed uniforms reference; pass to ShaderMaterial via a structural cast
  const uniforms = useMemo<EyeUniforms>(createEyeUniforms, []);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        // EyeUniforms is structurally { [key]: { value: T } }, compatible with THREE's uniforms dict
        uniforms: uniforms as unknown as Record<string, THREE.IUniform<unknown>>,
        transparent: false,
      }),
    [uniforms],
  );

  const fromIdxRef        = useRef(0);
  const toIdxRef          = useRef(0);
  const blendRef          = useRef(1.0); // fully blended to calm on first frame
  const blinkTimerRef     = useRef(0);
  const blinkPhaseRef     = useRef(0);
  const demoCycleTimerRef = useRef(0);
  const prevEmoteRef      = useRef<EmoteState | undefined>(undefined);

  useEffect(() => {
    return () => { mat.dispose(); };
  }, [mat]);

  useFrame((_, delta) => {
    if (prefersReducedMotion.current) return;

    // u is the typed EyeUniforms — mutate .value directly, no reconciler overhead
    const u = uniforms;

    // ── Demo cycle (no emote prop) or controlled mode ──
    if (emote === undefined) {
      demoCycleTimerRef.current += delta;
      if (demoCycleTimerRef.current >= DEMO_DWELL) {
        demoCycleTimerRef.current = 0;
        fromIdxRef.current = toIdxRef.current;
        toIdxRef.current = (toIdxRef.current + 1) % 5;
        blendRef.current = 0;
      }
    } else {
      if (emote !== prevEmoteRef.current) {
        fromIdxRef.current = toIdxRef.current;
        toIdxRef.current = EMOTE_INDEX[emote];
        blendRef.current = 0;
        prevEmoteRef.current = emote;
      }
    }

    blendRef.current = clamp(blendRef.current + delta / BLEND_DURATION, 0, 1);

    const from  = getStateParams(fromIdxRef.current);
    const to    = getStateParams(toIdxRef.current);
    const blend = blendRef.current;

    u.uTime.value      += delta;
    u.uStateBlend.value = blend;

    u.uHwFrom.value         = from.hw;
    u.uHhFrom.value         = from.hh;
    u.uRotFrom.value        = from.rot;
    u.uModeFrom.value       = from.mode;
    u.uSweepFrom.value      = from.sweep;
    u.uFlickerFrom.value    = from.flicker;
    u.uPulseFrom.value      = from.pulse;
    u.uBrightnessFrom.value = from.brightness;
    u.uHwTo.value           = to.hw;
    u.uHhTo.value           = to.hh;
    u.uRotTo.value          = to.rot;
    u.uModeTo.value         = to.mode;
    u.uSweepTo.value        = to.sweep;
    u.uFlickerTo.value      = to.flicker;
    u.uPulseTo.value        = to.pulse;
    u.uBrightnessTo.value   = to.brightness;

    // ── Blink ──
    const blinkInterval =
      from.blinkInterval + (to.blinkInterval - from.blinkInterval) * blend;

    blinkTimerRef.current += delta;
    if (blinkTimerRef.current > blinkInterval) {
      blinkTimerRef.current = 0;
      blinkPhaseRef.current = 0.001;
    }
    if (blinkPhaseRef.current > 0) {
      blinkPhaseRef.current += delta;
      const t = blinkPhaseRef.current / BLINK_DURATION;
      u.uBlink.value = t < 0.5 ? t * 2.0 : Math.max(0, (1.0 - t) * 2.0);
      if (blinkPhaseRef.current >= BLINK_DURATION) {
        blinkPhaseRef.current = 0;
        u.uBlink.value = 0;
      }
    }
  });

  return (
    // Concentric curved patch at radius 1.006 — fractionally proud of the visor (1.003)
    <mesh scale={[0.72, 1.0, 0.72]}>
      <sphereGeometry
        args={[1.006, phiSeg, thetaSeg, PHI_START, PHI_LENGTH, THETA_START, THETA_LENGTH]}
      />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}
