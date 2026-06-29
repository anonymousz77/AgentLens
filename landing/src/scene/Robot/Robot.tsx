import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Eye } from './Eye';
import { type RobotProps } from './types';
import { getQualityConfig } from '../../lib/quality';
import { prefersReducedMotion } from '../../lib/prefersReducedMotion';

// Spherical patch parameters shared with Eye.tsx
const PHI_START    = -Math.PI * 0.35;
const PHI_LENGTH   =  Math.PI * 0.70;
const THETA_START  =  Math.PI * 0.37;
const THETA_LENGTH =  Math.PI * 0.26;

export function Robot({ emote }: RobotProps) {
  const quality = useMemo(() => getQualityConfig(), []);

  // Geometry segment counts by quality tier
  const widSeg      = quality.tier === 'high' ? 64 : quality.tier === 'medium' ? 32 : 24;
  const podSeg      = quality.tier === 'high' ? 32 : quality.tier === 'medium' ? 24 : 16;
  const visorPhiSeg = quality.tier === 'high' ? 32 : quality.tier === 'medium' ? 24 : 16;
  const visorTheSeg = quality.tier === 'high' ? 16 : quality.tier === 'medium' ? 12 : 8;

  // Materials created once
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#e8eff7'),
        roughness: 0.20,
        metalness: 0.08,
        clearcoat: 0.9,
        clearcoatRoughness: 0.10,
        sheen: 0.15,
        sheenColor: new THREE.Color('#ffffff'),
        sheenRoughness: 0.40,
        envMapIntensity: 0.75,
      }),
    [],
  );

  const visorMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#0a0a0f'),
        roughness: 0.05,
        metalness: 0.30,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [],
  );

  // Animation refs
  const groupRef      = useRef<THREE.Group>(null);
  const leftPodRef    = useRef<THREE.Mesh>(null);
  const rightPodRef   = useRef<THREE.Mesh>(null);
  const timeRef       = useRef(0);
  const targetLookYRef = useRef(0);
  const targetLookXRef = useRef(0);
  const pointerRef    = useRef({ x: 0, y: 0 });

  // Window-level pointer tracking (canvas has pointer-events:none so we listen on window)
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth)  * 2 - 1;
      pointerRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, []);

  // Dispose materials on unmount
  useEffect(() => {
    return () => {
      bodyMaterial.dispose();
      visorMaterial.dispose();
    };
  }, [bodyMaterial, visorMaterial]);

  useFrame((_, delta) => {
    if (prefersReducedMotion.current) return;
    if (!groupRef.current || !leftPodRef.current || !rightPodRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    // Y float bob
    groupRef.current.position.y = Math.sin(t * Math.PI * 1.0) * 0.06;

    // Slow lateral drift
    groupRef.current.position.x = Math.sin(t * Math.PI * 0.26) * 0.04;

    // Cursor look-at: frame-rate-independent ease toward pointer
    // Phase 3/4 seam: replace oscY assignment with a full 2π spin when section transitions fire
    const decay = 1 - Math.pow(0.92, delta * 60);
    targetLookYRef.current += (pointerRef.current.x *  0.10 - targetLookYRef.current) * decay;
    targetLookXRef.current += (pointerRef.current.y * -0.06 - targetLookXRef.current) * decay;

    // Idle oscillation: ±28° Y sway, subtle X nod — face always toward viewer
    const oscY = Math.sin(t * Math.PI * 0.15) * 0.50;
    const oscX = Math.sin(t * Math.PI * 0.11) * 0.06;
    groupRef.current.rotation.y = oscY + targetLookYRef.current;
    groupRef.current.rotation.x = oscX + targetLookXRef.current;

    // Arm pods bob out of phase from body
    leftPodRef.current.position.y  = Math.sin(t * Math.PI * 1.0 + Math.PI)        * 0.07;
    rightPodRef.current.position.y = Math.sin(t * Math.PI * 1.0 + Math.PI * 0.5)  * 0.07;
  });

  return (
    // scale 1.6 → body fills ~57% viewport height at fov 50 / camera z 6
    // Phase 2: position will shift slightly right when environments land
    <group ref={groupRef} scale={1.6}>
      {/* Body — elongated ovoid (sphere scaled 0.72 in x/z) */}
      <mesh scale={[0.72, 1.0, 0.72]}>
        <sphereGeometry args={[1, widSeg, widSeg]} />
        <primitive object={bodyMaterial} attach="material" />
      </mesh>

      {/* Curved visor panel — spherical cap at radius 1.003 to sit flush-proud of body.
          The body surface naturally forms a rim/bezel around it. */}
      <mesh scale={[0.72, 1.0, 0.72]}>
        <sphereGeometry
          args={[1.003, visorPhiSeg, visorTheSeg, PHI_START, PHI_LENGTH, THETA_START, THETA_LENGTH]}
        />
        <primitive object={visorMaterial} attach="material" />
      </mesh>

      {/* Eye shader — a second concentric patch just proud of the visor */}
      <Eye emote={emote} phiSeg={visorPhiSeg} thetaSeg={visorTheSeg} />

      {/* Arm pods — detached floating elements, bob independently */}
      <mesh ref={leftPodRef} position={[-1.1, 0, 0]} scale={[1, 0.75, 1]}>
        <sphereGeometry args={[0.22, podSeg, podSeg]} />
        <primitive object={bodyMaterial} attach="material" />
      </mesh>

      <mesh ref={rightPodRef} position={[1.1, 0, 0]} scale={[1, 0.75, 1]}>
        <sphereGeometry args={[0.22, podSeg, podSeg]} />
        <primitive object={bodyMaterial} attach="material" />
      </mesh>
    </group>
  );
}
