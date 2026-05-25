import { useScrollStore } from './store';

// Thin selector — no side effects. Lenis setup and event listeners live in App.tsx.
export function useScrollProgress() {
  return useScrollStore((s) => ({
    scrollProgress: s.scrollProgress,
    activeSection: s.activeSection,
  }));
}
