import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

function CursorImpl() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef  = useRef<HTMLDivElement>(null);

  const rawX    = useMotionValue(-100);
  const rawY    = useMotionValue(-100);
  const dotRawX = useMotionValue(-100);
  const dotRawY = useMotionValue(-100);

  const ringX = useSpring(rawX,    { stiffness: 160, damping: 18, mass: 0.6 });
  const ringY = useSpring(rawY,    { stiffness: 160, damping: 18, mass: 0.6 });
  const dotX  = useSpring(dotRawX, { stiffness: 600, damping: 32, mass: 0.3 });
  const dotY  = useSpring(dotRawY, { stiffness: 600, damping: 32, mass: 0.3 });

  useEffect(() => {
    document.body.classList.add("custom-cursor");
    let rafId: number | null = null;

    const onMove = (e: MouseEvent) => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;

        // Dot tracks cursor exactly
        dotRawX.set(e.clientX - 2);
        dotRawY.set(e.clientY - 2);

        // Ring: magnetic pull toward nearest [data-magnetic] element
        let tx = e.clientX - 14;
        let ty = e.clientY - 14;
        const magnetics = document.querySelectorAll("[data-magnetic]");
        let closestDist = 80;
        magnetics.forEach((el) => {
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width  / 2;
          const cy = r.top  + r.height / 2;
          const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
          if (dist < closestDist) {
            closestDist = dist;
            const pull = (1 - dist / 80) * 0.28;
            tx = e.clientX - 14 + (cx - e.clientX) * pull;
            ty = e.clientY - 14 + (cy - e.clientY) * pull;
          }
        });
        rawX.set(tx);
        rawY.set(ty);

        // Context glow: walk DOM ancestors for [data-cursor-color]
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        let color = "rgba(38,43,52,0.9)";
        if (hit) {
          let node: Element | null = hit;
          while (node && node !== document.body) {
            const cc = node.getAttribute("data-cursor-color");
            if (cc) { color = cc; break; }
            node = node.parentElement;
          }
        }

        if (ringRef.current) {
          ringRef.current.style.borderColor = color;
          ringRef.current.style.boxShadow   = `0 0 12px ${color}`;
        }
        if (dotRef.current) {
          dotRef.current.style.background = color;
        }
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.body.classList.remove("custom-cursor");
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [rawX, rawY, dotRawX, dotRawY]);

  return (
    <>
      {/* Outer ring — spring-lagged with magnetic attraction */}
      <motion.div
        ref={ringRef as React.RefObject<HTMLDivElement>}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          x: ringX,
          y: ringY,
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "1px solid rgba(38,43,52,0.9)",
          pointerEvents: "none",
          zIndex: 9999,
          willChange: "transform",
        }}
        aria-hidden="true"
      />
      {/* Inner dot — tighter tracking */}
      <motion.div
        ref={dotRef as React.RefObject<HTMLDivElement>}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          x: dotX,
          y: dotY,
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: "rgba(64,69,79,0.9)",
          pointerEvents: "none",
          zIndex: 9999,
          willChange: "transform",
        }}
        aria-hidden="true"
      />
    </>
  );
}

export default function MagneticCursor() {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return null;
  if (typeof window !== "undefined" && "ontouchstart" in window) return null;
  return <CursorImpl />;
}
