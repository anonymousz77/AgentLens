import { useEffect, useState } from "react";
import { fetchMeta } from "../api/client";

const DISMISS_KEY = "agentlens-demo-banner-dismissed";

export default function DemoBanner() {
  const [autoDemo,  setAutoDemo]  = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "1"
  );

  useEffect(() => {
    fetchMeta()
      .then((m) => setAutoDemo(m.autoDemo))
      .catch(() => undefined);
  }, []);

  if (!autoDemo || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "1");
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 16px",
        background: "rgba(11,13,16,0.88)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
        color: "var(--text-muted)",
        fontSize: "13px",
        whiteSpace: "nowrap",
        maxWidth: "calc(100vw - 48px)",
      } as React.CSSProperties}
    >
      <span>
        Showing example data — run{" "}
        <code
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px",
            color: "var(--text-primary)",
            background: "rgba(255,255,255,0.06)",
            borderRadius: "4px",
            padding: "1px 5px",
          }}
        >
          agentlens session start
        </code>{" "}
        to record your first real session.
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss example data notice"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-dim)",
          fontSize: "16px",
          lineHeight: 1,
          padding: "2px 4px",
          borderRadius: "4px",
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
