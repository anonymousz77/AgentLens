/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" in demo builds (vite --mode demo) — serve synthetic data, no backend. */
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
