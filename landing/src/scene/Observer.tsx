import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScrollStore } from '../scroll/store';
import { getObserverColorHex } from '../lib/colors';
import { lerp } from '../lib/lerp';

interface ObserverProps {
  reducedMotion: boolean;
}

export function Observer({ reducedMotion }: ObserverProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // In reduced-motion mode render one static frame and skip all animation.
    if (reducedMotion) return;

    const p = useScrollStore.getState().scrollProgress;
    const mat = mesh.material as THREE.MeshStandardMaterial;

    // Rotation — constant base spin + scroll-driven tilt
    mesh.rotation.y += delta * 0.4;
    mesh.rotation.x = p * Math.PI * 0.5;
    mesh.rotation.z = Math.sin(p * Math.PI) * 0.3;

    // Scale — per-phase pulse, smoothed with lerp
    const targetScale = 1 + Math.sin(p * Math.PI * 5) * 0.15;
    const smoothedScale = lerp(mesh.scale.x, targetScale, Math.min(1, delta * 3));
    mesh.scale.setScalar(smoothedScale);

    // Position — float up and back down over full scroll range
    const targetY = Math.sin(p * Math.PI) * 1.5;
    mesh.position.y = lerp(mesh.position.y, targetY, Math.min(1, delta * 2));

    // Color — green→amber→red via shared interpolator (no THREE import needed)
    const hex = getObserverColorHex(p);
    mat.color.setStyle(hex);
    mat.emissive.setStyle(hex);
    mat.emissiveIntensity = 0.2;
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[2, 1]} />
      <meshStandardMaterial
        color="#22c55e"
        emissive="#22c55e"
        emissiveIntensity={0.2}
        metalness={0.3}
        roughness={0.6}
      />
    </mesh>
  );
}
