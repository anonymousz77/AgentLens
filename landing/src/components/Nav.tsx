import { getLenis } from '../scroll/lenis';
import { useScrollProgress } from '../scroll/useScrollProgress';
import { useMotionStore } from '../lib/prefersReducedMotion';

const SECTIONS = [
  { id: 'hero',    label: 'HERO',    index: 0 },
  { id: 'capture', label: 'CAPTURE', index: 1 },
  { id: 'depth',   label: 'DEPTH',   index: 2 },
  { id: 'proof',   label: 'PROOF',   index: 3 },
  { id: 'verdict', label: 'VERDICT', index: 4 },
] as const;

export function Nav() {
  const { activeSection } = useScrollProgress();
  const reducedMotion = useMotionStore((s) => s.current);

  const handleClick =
    (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      getLenis().scrollTo(`#${id}`, { duration: reducedMotion ? 0 : 1.2 });
    };

  return (
    <nav
      aria-label="Page sections"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: '3rem',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '1.5rem',
        paddingBottom: '1.5rem',
        borderRight: '1px solid #262b34',
        background: 'rgba(7,8,10,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* SKRY wordmark — reads bottom-to-top */}
      <div
        aria-label="SKRY"
        style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          fontFamily: '"Archivo", sans-serif',
          fontWeight: 700,
          fontSize: '0.875rem',
          letterSpacing: '0.2em',
          color: '#dde2ea',
          marginBottom: 'auto',
          userSelect: 'none',
        }}
      >
        SKRY
      </div>

      {/* Section dots */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        {SECTIONS.map(({ id, label, index }) => {
          const isActive = activeSection === index;
          return (
            <a
              key={id}
              href={`#${id}`}
              onClick={handleClick(id)}
              aria-label={`Scroll to ${label}`}
              className="nav-dot"
              style={{
                display: 'block',
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%',
                background: isActive ? '#22c55e' : '#262b34',
                boxShadow: isActive ? '0 0 8px #22c55e' : 'none',
                transition: reducedMotion
                  ? 'none'
                  : 'background 0.3s ease, box-shadow 0.3s ease',
                outline: 'none',
                textDecoration: 'none',
              }}
            />
          );
        })}
      </div>
    </nav>
  );
}
