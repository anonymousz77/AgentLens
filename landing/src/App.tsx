import { useEffect } from 'react';
import type Lenis from 'lenis';
import { Scene } from './scene/Scene';
import { Nav } from './components/Nav';
import { HUD } from './components/HUD';
import { Hero } from './sections/Hero';
import { Capture } from './sections/Capture';
import { Depth } from './sections/Depth';
import { Proof } from './sections/Proof';
import { Verdict } from './sections/Verdict';
import { getLenis, startLenis } from './scroll/lenis';
import { useScrollStore } from './scroll/store';

const SECTION_IDS = ['hero', 'capture', 'depth', 'proof', 'verdict'] as const;

export default function App() {
  useEffect(() => {
    // Read section offsetTop values so the store can compute activeSection accurately.
    const updateOffsets = () => {
      const offsets = SECTION_IDS.map(
        (id) => document.getElementById(id)?.offsetTop ?? 0
      );
      useScrollStore.getState().setSections(offsets);
    };

    updateOffsets();

    const stop = startLenis();
    const lenis = getLenis();

    // The Lenis scroll event emits the Lenis instance as the first argument.
    const handleScroll = (e: Lenis) => {
      useScrollStore.getState().setScroll(e.scroll, e.limit);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lenis as any).on('scroll', handleScroll);

    // Recompute offsets if the window resizes (sections can shift on reflow).
    window.addEventListener('resize', updateOffsets);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (lenis as any).off('scroll', handleScroll);
      window.removeEventListener('resize', updateOffsets);
      stop();
    };
  }, []);

  return (
    <>
      {/* Layer 0: fixed 3D canvas, pointer-events:none, z-index:0 */}
      <Scene />

      {/* Layer 1: fixed UI chrome, z-index:40/50 */}
      <Nav />
      <HUD />

      {/* Layer 2: scrollable page content, z-index:1 */}
      <main style={{ position: 'relative', zIndex: 1 }}>
        <Hero />
        <Capture />
        <Depth />
        <Proof />
        <Verdict />
        {/* Breathing room so Verdict fully settles and activeSection reliably reaches 4 */}
        <div style={{ height: '20svh' }} />
      </main>
    </>
  );
}
