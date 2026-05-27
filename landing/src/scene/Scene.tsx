import { Canvas } from '@react-three/fiber';
import { getQualityConfig } from '../lib/quality';

export function Scene() {
  const quality = getQualityConfig();

  return (
    <Canvas
      aria-hidden="true"
      camera={{ position: [0, 0, 6], fov: 50 }}
      dpr={[1, quality.dpr]}
      gl={{ antialias: quality.tier !== 'low', powerPreference: 'high-performance' }}
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
    </Canvas>
  );
}
