// IMPORTANT: WEBGL_debug_renderer_info is increasingly masked by browsers
// (Firefox hides it by default; Chrome may return a generic masked string).
// The GPU-string tier below is a HINT only.
// Later phases MUST add a runtime FPS-based downgrade: measure frame time over
// ~30 frames after load; if sustained below target (e.g. 50 fps), call
// overrideQualityTier('low') and drop dpr/bloom/particles. Do NOT rely solely
// on the renderer string.

export type QualityTier = 'high' | 'medium' | 'low';

export interface QualityConfig {
  tier: QualityTier;
  dpr: number;
  bloomEnabled: boolean;
  particleMultiplier: number; // 1.0 / 0.6 / 0.3 — for later phases
  shadowsEnabled: boolean;
  transmissionSamples: number;    // MeshTransmissionMaterial samples; 0 = use cheap fallback
  transmissionResolution: number; // FBO resolution for transmission buffer
  environmentResolution: number;  // Environment cubemap resolution
}

const TIER_CONFIGS = {
  high:   { tier: 'high'   as const, dpr: 2,   bloomEnabled: true,  particleMultiplier: 1.0, shadowsEnabled: true,  transmissionSamples: 10, transmissionResolution: 1024, environmentResolution: 256 },
  medium: { tier: 'medium' as const, dpr: 1.5, bloomEnabled: true,  particleMultiplier: 0.6, shadowsEnabled: false, transmissionSamples: 6,  transmissionResolution: 512,  environmentResolution: 128 },
  low:    { tier: 'low'    as const, dpr: 1,   bloomEnabled: false, particleMultiplier: 0.3, shadowsEnabled: false, transmissionSamples: 0,  transmissionResolution: 256,  environmentResolution: 64  },
} satisfies Record<QualityTier, QualityConfig>;

function detectTier(): QualityTier {
  if (typeof window === 'undefined') return 'high';

  const canvas = document.createElement('canvas');
  const gl =
    (canvas.getContext('webgl2') as WebGLRenderingContext | null) ??
    (canvas.getContext('webgl') as WebGLRenderingContext | null);
  if (!gl) return 'low';

  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (!ext) return 'medium';

  const renderer = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string).toLowerCase();

  if (renderer.includes('swiftshader') || renderer.includes('llvmpipe') || renderer.includes('softpipe')) {
    return 'low';
  }
  if (/adreno|mali|powervr|tegra/.test(renderer)) {
    return 'medium';
  }
  return 'high';
}

let _config: QualityConfig | null = null;

export function getQualityConfig(): QualityConfig {
  if (!_config) {
    _config = TIER_CONFIGS[detectTier()];
  }
  return _config;
}

// Seam for testing and future "performance mode" user toggle.
export function overrideQualityTier(tier: QualityTier): void {
  _config = TIER_CONFIGS[tier];
}
