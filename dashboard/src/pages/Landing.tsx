import { useState, Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  FlaskConical,
  BarChart3,
  GitCommit,
  Brain,
  Shield,
} from "lucide-react";
const ConstellationScene = lazy(() => import("../three/ConstellationScene"));
import type { SessionSummary } from "../api/types";

const EMPTY_SESSIONS: SessionSummary[] = [];

// ─── Nav ──────────────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        height: "60px",
        background: "rgba(14,16,20,0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 32 32"
          aria-hidden="true"
          style={{ filter: "drop-shadow(0 0 6px var(--score-hi))" }}
        >
          <circle cx="16" cy="16" r="12" fill="var(--score-hi)" opacity="0.9" />
          <circle cx="16" cy="16" r="5" fill="var(--bg-base)" />
        </svg>
        <span
          style={{
            fontFamily: "Archivo, sans-serif",
            fontWeight: 600,
            color: "var(--text-primary)",
            fontSize: "14px",
            letterSpacing: "-0.01em",
          }}
        >
          AgentLens
        </span>
      </div>

      {/* Center links */}
      <div style={{ display: "flex", gap: "28px", alignItems: "center" }}>
        {(
          [
            { href: "#features", label: "Features" },
            { href: "#how-it-works", label: "How it works" },
            {
              href: "https://github.com/anonymousz77/AgentLens",
              label: "GitHub",
              external: true,
            },
            { href: "#", label: "Docs" },
          ] as { href: string; label: string; external?: boolean }[]
        ).map(({ href, label, external }) => (
          <a
            key={label}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            style={{
              color: "var(--text-muted)",
              textDecoration: "none",
              fontSize: "13px",
              fontFamily: "Hanken Grotesk, sans-serif",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
          >
            {label}
          </a>
        ))}
      </div>

      {/* CTA */}
      <Link
        to="/app"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "6px 16px",
          border: "1px solid var(--score-hi)",
          borderRadius: "4px",
          color: "var(--score-hi)",
          textDecoration: "none",
          fontSize: "13px",
          fontFamily: "Archivo, sans-serif",
          fontWeight: 500,
          background: "transparent",
          transition: "background 0.15s ease",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(34,197,94,0.08)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "transparent")
        }
      >
        Open Dashboard
      </Link>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText("npx agentlens init").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: "96px",
        paddingBottom: "60px",
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      {/* Background constellation — faint starfield */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.12,
          pointerEvents: "none",
          zIndex: 0,
        }}
        aria-hidden="true"
      >
        <Suspense fallback={null}>
          <ConstellationScene sessions={EMPTY_SESSIONS} onSelect={() => {}} />
        </Suspense>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "820px",
          padding: "0 24px",
        }}
      >
        <h1
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 400,
            fontSize: "clamp(1.75rem, 5vw, 3.75rem)",
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            marginBottom: "20px",
          }}
        >
          See what your AI agent actually did.
        </h1>
        <p
          style={{
            fontFamily: "Hanken Grotesk, sans-serif",
            fontSize: "clamp(1rem, 2vw, 1.2rem)",
            color: "var(--text-muted)",
            marginBottom: "40px",
            lineHeight: 1.6,
          }}
        >
          Local-first observability and scoring for AI coding-agent sessions.
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={handleCopy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 20px",
              background: "var(--bg-surface)",
              border: "1px solid var(--score-hi)",
              borderRadius: "4px",
              color: "var(--score-hi)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "14px",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(34,197,94,0.06)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--bg-surface)")
            }
          >
            <span>$ npx agentlens init</span>
            <span
              style={{
                fontSize: "11px",
                color: copied ? "var(--score-hi)" : "var(--text-dim)",
                transition: "color 0.15s ease",
              }}
            >
              {copied ? "✓ copied" : "copy"}
            </span>
          </button>

          <a
            href="https://github.com/anonymousz77/AgentLens"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "10px 20px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              color: "var(--text-primary)",
              textDecoration: "none",
              fontFamily: "Archivo, sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              transition: "border-color 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "var(--text-muted)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "var(--border)")
            }
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Problem strip ────────────────────────────────────────────────────────────

function ProblemStrip() {
  const cards = [
    {
      title: "Silent Regressions",
      body: "Tests go green, but type errors grow. You only notice next sprint.",
    },
    {
      title: "Wasted Spend",
      body: "Token cost climbs. Impact on code quality stays unknown.",
    },
    {
      title: "No Comparison",
      body: "Claude vs Cursor. Session A vs Session B. No data, no answer.",
    },
  ];

  return (
    <section style={{ padding: "80px 24px", maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
      <p
        style={{
          fontFamily: "Hanken Grotesk, sans-serif",
          fontSize: "clamp(1rem, 2vw, 1.15rem)",
          color: "var(--text-primary)",
          marginBottom: "48px",
          lineHeight: 1.6,
        }}
      >
        Agents edit your code. Tests pass or fail. Did the session help or quietly hurt?
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        {cards.map(({ title, body }) => (
          <div
            key={title}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "20px",
              textAlign: "left",
            }}
          >
            <h3
              style={{
                fontFamily: "Archivo, sans-serif",
                fontWeight: 600,
                fontSize: "14px",
                color: "var(--text-primary)",
                marginBottom: "8px",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontFamily: "Hanken Grotesk, sans-serif",
                fontSize: "13px",
                color: "var(--text-muted)",
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Features grid ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    Icon: Camera,
    title: "Session Capture",
    body: "Snapshots repo state before and after any agent run.",
  },
  {
    Icon: FlaskConical,
    title: "Test · Type · Lint",
    body: "Auto-detects vitest/pytest/tsc/eslint and runs them for you.",
  },
  {
    Icon: BarChart3,
    title: "Deterministic Scoring",
    body: "A 0–100 formula with configurable weights — no vibes.",
  },
  {
    Icon: GitCommit,
    title: "Regression Attribution",
    body: "Pinpoints which commit introduced a drop via O(log n) bisection.",
  },
  {
    Icon: Brain,
    title: "LLM-as-Judge",
    body: "Calibrated semantic review as an optional scored dimension.",
  },
  {
    Icon: Shield,
    title: "CI Mode",
    body: "agentlens ci --min-score 72 gates merges by score.",
  },
] as const;

function FeaturesGrid() {
  return (
    <section
      id="features"
      style={{ padding: "80px 24px", maxWidth: "1000px", margin: "0 auto" }}
    >
      <h2
        style={{
          fontFamily: "Archivo, sans-serif",
          fontWeight: 600,
          fontSize: "clamp(1.25rem, 3vw, 2rem)",
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
          marginBottom: "40px",
          textAlign: "center",
        }}
      >
        Everything you need to trust your agents
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {FEATURES.map(({ Icon, title, body }) => (
          <div
            key={title}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "20px",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(34,197,94,0.45)";
              e.currentTarget.style.boxShadow =
                "0 0 16px rgba(34,197,94,0.10)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <Icon
              size={20}
              strokeWidth={1.5}
              style={{ color: "var(--score-hi)", marginBottom: "12px", display: "block" }}
              aria-hidden="true"
            />
            <h3
              style={{
                fontFamily: "Archivo, sans-serif",
                fontWeight: 600,
                fontSize: "14px",
                color: "var(--text-primary)",
                marginBottom: "6px",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontFamily: "Hanken Grotesk, sans-serif",
                fontSize: "13px",
                color: "var(--text-muted)",
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Snapshot",
    caption: "Capture repo state + git diff before the agent starts.",
  },
  {
    n: "02",
    title: "Run Checks",
    caption: "Execute tests, type-checker, and linter. Parse results.",
  },
  {
    n: "03",
    title: "Score",
    caption: "Apply the weighted formula. Store to local SQLite.",
  },
  {
    n: "04",
    title: "Compare",
    caption: "Side-by-side sessions, agents, or CI gates.",
  },
] as const;

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      style={{ padding: "80px 24px", maxWidth: "900px", margin: "0 auto" }}
    >
      <h2
        style={{
          fontFamily: "Archivo, sans-serif",
          fontWeight: 600,
          fontSize: "clamp(1.25rem, 3vw, 2rem)",
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
          marginBottom: "48px",
          textAlign: "center",
        }}
      >
        How it works
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        {STEPS.map(({ n, title, caption }, i) => (
          <div
            key={n}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              padding: "0 16px",
              position: "relative",
            }}
          >
            {/* Connector line between badges */}
            {i < STEPS.length - 1 && (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: "19px",
                  left: "calc(50% + 22px)",
                  right: "calc(-50% + 22px)",
                  height: "1px",
                  background: "var(--border)",
                }}
              />
            )}

            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "1px solid var(--score-hi)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                color: "var(--score-hi)",
                marginBottom: "16px",
                background: "rgba(34,197,94,0.06)",
                flexShrink: 0,
                position: "relative",
                zIndex: 1,
              }}
            >
              {n}
            </div>

            <h3
              style={{
                fontFamily: "Archivo, sans-serif",
                fontWeight: 600,
                fontSize: "14px",
                color: "var(--text-primary)",
                marginBottom: "8px",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                color: "var(--text-muted)",
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {caption}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Live preview ─────────────────────────────────────────────────────────────

function LivePreview() {
  return (
    <section
      style={{
        padding: "80px 24px",
        maxWidth: "1000px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <h2
        style={{
          fontFamily: "Archivo, sans-serif",
          fontWeight: 600,
          fontSize: "clamp(1.25rem, 3vw, 2rem)",
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
          marginBottom: "32px",
        }}
      >
        See it live
      </h2>

      <img
        src="/preview.png"
        alt="AgentLens constellation dashboard"
        // Hide gracefully rather than show a broken-image icon if the static
        // screenshot hasn't been dropped into dashboard/public/ yet.
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
        style={{
          width: "100%",
          maxHeight: "560px",
          objectFit: "cover",
          objectPosition: "top",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          boxShadow: "0 0 32px rgba(34,197,94,0.08)",
          display: "block",
        }}
      />

      <div style={{ marginTop: "20px" }}>
        <Link
          to="/app?demo=1"
          style={{
            color: "var(--score-hi)",
            fontFamily: "Archivo, sans-serif",
            fontSize: "14px",
            fontWeight: 500,
            textDecoration: "none",
            transition: "opacity 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Try the live demo →
        </Link>
      </div>
    </section>
  );
}

// ─── CI block ─────────────────────────────────────────────────────────────────

const CI_LINES: { text: string; green?: true }[] = [
  { text: "$ agentlens ci --min-score 72", green: true },
  { text: "✓  Snapshot taken   (3 files changed)", green: true },
  { text: "✓  Tests            147 passed · 0 failed", green: true },
  { text: "✓  Type-check       0 errors", green: true },
  { text: "✓  Lint             0 warnings", green: true },
  { text: "   Score  88 / 100  ▲ +4 from baseline" },
  { text: "   Gate   PASS  (88 ≥ 72)", green: true },
];

function CIBlock() {
  return (
    <section
      style={{ padding: "80px 24px", maxWidth: "760px", margin: "0 auto" }}
    >
      <h2
        style={{
          fontFamily: "Archivo, sans-serif",
          fontWeight: 600,
          fontSize: "clamp(1.25rem, 3vw, 2rem)",
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        Gate your merges
      </h2>

      <pre
        style={{
          background: "var(--bg-base)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "20px 24px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "13px",
          lineHeight: 1.75,
          overflowX: "auto",
          margin: "0 0 20px",
        }}
      >
        {CI_LINES.map(({ text, green }, i) => (
          <div
            key={i}
            style={{ color: green ? "var(--score-hi)" : "var(--text-muted)" }}
          >
            {text}
          </div>
        ))}
      </pre>

      <p
        style={{
          fontFamily: "Hanken Grotesk, sans-serif",
          fontSize: "13px",
          color: "var(--text-muted)",
          textAlign: "center",
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        Set{" "}
        <code
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            color: "var(--score-hi)",
          }}
        >
          --min-score
        </code>{" "}
        in CI. Fail the pipeline on regressions.
      </p>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        padding: "40px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "16px",
        maxWidth: "1000px",
        margin: "0 auto",
      }}
    >
      <p
        style={{
          fontFamily: "Hanken Grotesk, sans-serif",
          fontSize: "13px",
          color: "var(--text-dim)",
          margin: 0,
        }}
      >
        © 2025 AgentLens — MIT License
      </p>
      <div style={{ display: "flex", gap: "20px" }}>
        {[
          {
            href: "https://github.com/anonymousz77/AgentLens",
            label: "GitHub",
          },
          { href: "#", label: "npm" },
          { href: "#", label: "MIT" },
        ].map(({ href, label }) => (
          <a
            key={label}
            href={href}
            style={{
              fontFamily: "Hanken Grotesk, sans-serif",
              fontSize: "13px",
              color: "var(--text-dim)",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-dim)")
            }
          >
            {label}
          </a>
        ))}
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100svh" }}>
      <LandingNav />
      <HeroSection />
      <hr className="glow-divider" />
      <ProblemStrip />
      <hr className="glow-divider" />
      <FeaturesGrid />
      <hr className="glow-divider" />
      <HowItWorks />
      <hr className="glow-divider" />
      <LivePreview />
      <hr className="glow-divider" />
      <CIBlock />
      <hr className="glow-divider" />
      <Footer />
    </div>
  );
}
