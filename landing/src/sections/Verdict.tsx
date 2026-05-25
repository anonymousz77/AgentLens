export function Verdict() {
  return (
    <section
      id="verdict"
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
        VERDICT
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
        A single score: did this agent session make things better?
      </p>
    </section>
  );
}
