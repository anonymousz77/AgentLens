import type { AgentStats, SessionDetail, SessionSummary } from "./types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const fetchSessions = (): Promise<SessionSummary[]> =>
  get<SessionSummary[]>("/api/sessions");

export const fetchStats = (): Promise<AgentStats> =>
  get<AgentStats>("/api/stats");

export const fetchSessionDetail = (id: string): Promise<SessionDetail> =>
  get<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}`);
