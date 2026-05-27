export function Hero() {
  return (
    <section
      id="hero"
      style={{
        height: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 4rem',
        background: 'linear-gradient(to bottom, #7c3a1a, #4a1f08)',
      }}
    >
      <h1
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
        Did your agent make the codebase better — or quietly worse?
      </h1>
    </section>
  );
}
