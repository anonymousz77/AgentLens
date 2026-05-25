import { useScrollProgress } from '../scroll/useScrollProgress';
import { getObserverColorHex } from '../lib/colors';
import { useMotionStore } from '../lib/prefersReducedMotion';

export function HUD() {
  const { scrollProgress } = useScrollProgress();
  const reducedMotion = useMotionStore((s) => s.current);

  // Ticks 100 → 32 across the full scroll range (100 - 68 * progress).
  const value = reducedMotion ? 100 : Math.round(100 - 68 * scrollProgress);
  const color = reducedMotion ? 'rgb(34,197,94)' : getObserverColorHex(scrollProgress);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: '1.5rem',
        right: '2rem',
        zIndex: 50,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 'clamp(0.875rem, 1.5vw, 1.125rem)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.1em',
        color,
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {String(value).padStart(3, '0')}
    </div>
  );
}
