/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        "bg-base": "var(--bg-base)",
        "bg-surface": "var(--bg-surface)",
        "bg-overlay": "var(--bg-overlay)",
        "bg-raised": "var(--bg-raised)",
        border: "var(--border)",
        "border-muted": "var(--border-muted)",
        primary: "var(--text-primary)",
        muted: "var(--text-muted)",
        dim: "var(--text-dim)",
        "score-hi": "var(--score-hi)",
        "score-mid": "var(--score-mid)",
        "score-lo": "var(--score-lo)",
      },
      fontFamily: {
        display: ["Archivo", "sans-serif"],
        body: ["Hanken Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
