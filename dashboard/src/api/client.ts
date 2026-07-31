import type { AgentStats, SessionDetail, SessionSummary } from "./types";
import { getDemoSessions, getDemoSession, getDemoStats } from "./demoData";

// In demo builds (VITE_DEMO=1, e.g. the public Vercel deployment) there is no
// backend — every call resolves from the client-side synthetic generator. Vite
// statically replaces this flag, so the non-demo branch and demoData are
// dead-code-eliminated / tree-shaken out of the normal CLI build.
const DEMO = import.meta.env.VITE_DEMO === "1";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const fetchSessions = (): Promise<SessionSummary[]> =>
  DEMO
    ? Promise.resolve(getDemoSessions())
    : get<SessionSummary[]>("/api/sessions");

export const fetchStats = (): Promise<AgentStats> =>
  DEMO ? Promise.resolve(getDemoStats()) : get<AgentStats>("/api/stats");

export const fetchSessionDetail = (id: string): Promise<SessionDetail> =>
  DEMO
    ? Promise.resolve(getDemoSession(id)).then((d) => {
        if (d === null) throw new Error(`GET /api/sessions/${id} → 404`);
        return d;
      })
    : get<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}`);

export const fetchMeta = (): Promise<{ demo: boolean; autoDemo: boolean }> =>
  DEMO
    ? Promise.resolve({ demo: true, autoDemo: true })
    : get<{ demo: boolean; autoDemo: boolean }>("/api/meta");
