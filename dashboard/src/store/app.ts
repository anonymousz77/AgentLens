import { create } from "zustand";
import type { AgentStats, SessionDetail, SessionSummary } from "../api/types";
import * as client from "../api/client";

interface LoadingState {
  sessions: boolean;
  stats: boolean;
  detail: boolean;
}

interface AppState {
  sessions: SessionSummary[];
  stats: AgentStats | null;
  detail: SessionDetail | null;
  detailId: string | null;
  loading: LoadingState;
  error: string | null;
  fetchSessions: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchDetail: (id: string) => Promise<void>;
  clearDetail: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  sessions: [],
  stats: null,
  detail: null,
  detailId: null,
  loading: { sessions: false, stats: false, detail: false },
  error: null,

  fetchSessions: async () => {
    if (get().loading.sessions) return;
    set((s) => ({ loading: { ...s.loading, sessions: true }, error: null }));
    try {
      const sessions = await client.fetchSessions();
      set((s) => ({ sessions, loading: { ...s.loading, sessions: false } }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, sessions: false },
        error: err instanceof Error ? err.message : "Failed to load sessions",
      }));
    }
  },

  fetchStats: async () => {
    if (get().loading.stats) return;
    set((s) => ({ loading: { ...s.loading, stats: true } }));
    try {
      const stats = await client.fetchStats();
      set((s) => ({ stats, loading: { ...s.loading, stats: false } }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, stats: false },
        error: err instanceof Error ? err.message : "Failed to load stats",
      }));
    }
  },

  fetchDetail: async (id: string) => {
    if (get().detailId === id && get().detail !== null) return;
    set((s) => ({ loading: { ...s.loading, detail: true }, detail: null, detailId: id }));
    try {
      const detail = await client.fetchSessionDetail(id);
      set((s) => ({ detail, loading: { ...s.loading, detail: false } }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, detail: false },
        detailId: null,
        error: err instanceof Error ? err.message : "Failed to load session",
      }));
    }
  },

  clearDetail: () => set({ detail: null, detailId: null }),
}));
