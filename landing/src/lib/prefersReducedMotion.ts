import { create } from 'zustand';

interface MotionState {
  current: boolean;
}

const mq: MediaQueryList | null =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

export const useMotionStore = create<MotionState>(() => ({
  current: mq?.matches ?? false,
}));

// Live listener — updates without a page reload when the user changes OS setting.
if (mq) {
  mq.addEventListener('change', (e: MediaQueryListEvent) => {
    useMotionStore.setState({ current: e.matches });
  });
}

// Sync accessor for non-React contexts (e.g. lenis.ts singleton init).
export const prefersReducedMotion = {
  get current(): boolean {
    return useMotionStore.getState().current;
  },
};
