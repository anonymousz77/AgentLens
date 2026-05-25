export function Globe() {
  return (
    <section
      id="globe"
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingLeft: '5rem',
        paddingRight: '2rem',
        background: 'transparent',
      }}
    >
      <h2
        style={{
          fontFamily: '"Archivo", sans-serif',
          fontWeight: 700,
          fontSize: 'clamp(2rem, 5vw, 4rem)',
          color: '#dde2ea',
          margin: 0,
          letterSpacing: '-0.02em',
        }}
      >
        GLOBE
      </h2>
      <p
        style={{
          fontFamily: '"Hanken Grotesk", sans-serif',
          color: '#7a8394',
          marginTop: '1rem',
          fontSize: '1.125rem',
          maxWidth: '40ch',
        }}
      >
        Local-first. Your data stays on your machine.
      </p>
    </section>
  );
}
