import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import SessionsList from "./pages/SessionsList";
import SessionDetail from "./pages/SessionDetail";
import { useAppStore } from "./store/app";

export default function App() {
  const fetchSessions = useAppStore((s) => s.fetchSessions);
  const fetchStats = useAppStore((s) => s.fetchStats);

  useEffect(() => {
    void fetchSessions();
    void fetchStats();

    // Refresh on window focus
    const onFocus = () => {
      void fetchSessions();
      void fetchStats();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchSessions, fetchStats]);

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/sessions" element={<SessionsList />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}
