import { create } from 'zustand';

interface ScrollState {
  scrollProgress: number;   // 0–1 continuous — drives mesh / HUD / color
  activeSection: number;    // 0–4 discrete, DOM-offset-based — drives Nav highlight
  _sectionOffsets: number[];
  setScroll: (scrollPx: number, limitPx: number) => void;
  setSections: (offsets: number[]) => void;
}

export const useScrollStore = create<ScrollState>((set, get) => ({
  scrollProgress: 0,
  activeSection: 0,
  _sectionOffsets: [],

  setScroll(scrollPx, limitPx) {
    const progress =
      limitPx > 0 ? Math.max(0, Math.min(1, scrollPx / limitPx)) : 0;

    // Find which section's top is <= midpoint of the current viewport.
    // Uses real DOM offsetTop values so it works even if sections differ in height.
    const vh =
      typeof window !== 'undefined' ? window.innerHeight : 800;
    const midpoint = scrollPx + vh * 0.5;

    const offsets = get()._sectionOffsets;
    let active = 0;
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      if (offset !== undefined && offset <= midpoint) {
        active = i;
      }
    }

    set({ scrollProgress: progress, activeSection: active });
  },

  setSections(offsets) {
    set({ _sectionOffsets: offsets });
  },
}));
