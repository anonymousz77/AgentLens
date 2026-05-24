import { useEffect, useRef } from "react";

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`;

const GRID = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M 40 0 L 0 0 0 40' fill='none' stroke='%23dde2ea' stroke-width='0.5' stroke-opacity='0.04'/%3E%3C/svg%3E")`;

export default function AtmosphericBackground() {
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number | null = null;
    let pendingX = 0.5;
    let pendingY = 0.5;

    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX / window.innerWidth;
      pendingY = e.clientY / window.innerHeight;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const ox = (pendingX - 0.5) * 65;
        const oy = (pendingY - 0.5) * 48;
        if (orb1Ref.current) {
          orb1Ref.current.style.transform = `translate(${ox}px, ${oy}px)`;
        }
        if (orb2Ref.current) {
          orb2Ref.current.style.transform = `translate(${-ox * 0.80}px, ${-oy * 0.65}px)`;
        }
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      {/* Atmospheric orbs — z-index -1, behind all content */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        {/* Orb 1 — top-left, score-hi green tint */}
        <div
          ref={orb1Ref}
          style={{ position: "absolute", top: "-15vw", left: "-10vw", width: "80vw", height: "80vw" }}
        >
          <div
            className="atm-drift-1"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(34,197,94,0.13) 0%, transparent 70%)",
              animation: "atm-drift-1 38s ease-in-out infinite alternate",
            }}
          />
        </div>

        {/* Orb 2 — bottom-right, score-lo red tint */}
        <div
          ref={orb2Ref}
          style={{ position: "absolute", bottom: "-12vw", right: "-8vw", width: "70vw", height: "70vw" }}
        >
          <div
            className="atm-drift-2"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)",
              animation: "atm-drift-2 52s ease-in-out infinite alternate",
            }}
          />
        </div>

        {/* Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 85% 80% at 50% 45%, transparent 28%, #07080a 100%)",
          }}
        />
      </div>

      {/* Instrument grid overlay — above content */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: GRID,
          backgroundRepeat: "repeat",
          pointerEvents: "none",
          zIndex: 9997,
        }}
        aria-hidden="true"
      />

      {/* Film grain overlay — above content */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: GRAIN,
          backgroundRepeat: "repeat",
          opacity: 0.075,
          pointerEvents: "none",
          zIndex: 9998,
          mixBlendMode: "screen",
        } as React.CSSProperties}
        aria-hidden="true"
      />
    </>
  );
}
