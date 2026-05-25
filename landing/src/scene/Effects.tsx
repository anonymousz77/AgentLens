import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type { QualityConfig } from '../lib/quality';

interface EffectsProps {
  quality: QualityConfig;
}

export function Effects({ quality }: EffectsProps) {
  if (!quality.bloomEnabled) return null;

  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.5}
        luminanceSmoothing={0.025}
        intensity={0.5}
      />
    </EffectComposer>
  );
}
