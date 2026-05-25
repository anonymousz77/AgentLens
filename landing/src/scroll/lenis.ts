import Lenis from 'lenis';
import { prefersReducedMotion } from '../lib/prefersReducedMotion';

let _lenis: Lenis | null = null;
let _rafId: number | null = null;

export function getLenis(): Lenis {
  if (!_lenis) {
    _lenis = new Lenis(
      prefersReducedMotion.current
        ? { duration: 0 }
        : {
            duration: 1.2,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            touchMultiplier: 1.5,
          }
    );
  }
  return _lenis;
}

// Starts the RAF loop. Returns a cleanup fn for useEffect.
// Also registers an HMR dispose handler so dev hot-reload never stacks duplicate instances.
export function startLenis(): () => void {
  const lenis = getLenis();

  function loop(time: number) {
    lenis.raf(time);
    _rafId = requestAnimationFrame(loop);
  }
  _rafId = requestAnimationFrame(loop);

  const stop = () => {
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
    lenis.destroy();
    _lenis = null;
  };

  // Vite HMR: tear down on hot-reload so we never stack two rAF loops.
  if (import.meta.hot) {
    import.meta.hot.dispose(stop);
  }

  return stop;
}
