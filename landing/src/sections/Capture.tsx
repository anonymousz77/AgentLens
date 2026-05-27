export function Capture() {
  return (
    <section
      id="capture"
      style={{
        height: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 4rem',
        background: 'linear-gradient(to bottom, #14532d, #0a2e18)',
      }}
    >
      <h2
        style={{
          fontFamily: '"Archivo", sans-serif',
          fontWeight: 700,
          fontSize: 'clamp(1.75rem, 4vw, 3.5rem)',
          color: '#dde2ea',
          textAlign: 'center',
          maxWidth: '48rem',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        It runs your tests, types, and lint — then scores what changed.
      </h2>
    </section>
  );
}
