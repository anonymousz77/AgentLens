import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';
import { getQualityConfig } from '../lib/quality';
import { Robot } from './Robot';

export function Scene() {
  const quality = getQualityConfig();

  return (
    <Canvas
      aria-hidden="true"
      camera={{ position: [0, 0, 6], fov: 50 }}
      dpr={[1, quality.dpr]}
      gl={{
        antialias: quality.tier !== 'low',
        powerPreference: 'high-performance',
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 0.90,
      }}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <color attach="background" args={['#07080a']} />

      {/* Three-point lighting: key (warm) + fill (cool) + rim (back-separation) */}
      <ambientLight intensity={0.20} />
      <directionalLight position={[3, 4, 3]}   intensity={1.6} color="#fff5ec" />
      <directionalLight position={[-2, -1, 2]}  intensity={0.6} color="#e8f0ff" />
      <directionalLight position={[0, 2, -4]}   intensity={1.4} color="#ffffff" />

      {/* Neutral studio IBL for clearcoat reflections — background=false keeps #07080a */}
      <Environment preset="studio" background={false} />

      {/* Robot — emote prop absent triggers internal demo cycle through all 5 states */}
      <Robot />
    </Canvas>
  );
}
