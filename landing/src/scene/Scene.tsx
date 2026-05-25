import { Canvas } from '@react-three/fiber';
import { Observer } from './Observer';
import { Effects } from './Effects';
import { getQualityConfig } from '../lib/quality';
import { useMotionStore } from '../lib/prefersReducedMotion';

// SMOKE TEST (dev only): to verify Effects mounts without throwing, temporarily
// uncomment the line below and comment out getQualityConfig(). Remove before shipping.
// import { overrideQualityTier } from '../lib/quality';
// overrideQualityTier('high');

export function Scene() {
  const reducedMotion = useMotionStore((s) => s.current);
  const quality = getQualityConfig();

  return (
    <Canvas
      aria-hidden="true"
      frameloop="always"
      camera={{ position: [0, 0, 6], fov: 50 }}
      dpr={[1, quality.dpr]}
      gl={{ antialias: quality.tier !== 'low', powerPreference: 'high-performance' }}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        // Must be none so the Canvas never intercepts scroll or text selection.
        pointerEvents: 'none',
      }}
    >
      <color attach="background" args={['#07080a']} />
      <ambientLight intensity={0.3} />
      <pointLight position={[4, 4, 4]} intensity={2} />
      <pointLight position={[-4, -3, -4]} intensity={0.4} color="#f59e0b" />

      <Observer reducedMotion={reducedMotion} />

      {/* Effects skipped when reduced-motion is active. Canvas still paints the
          static mesh, so users with reduced-motion see the shape, not a blank page. */}
      {!reducedMotion && <Effects quality={quality} />}
    </Canvas>
  );
}
