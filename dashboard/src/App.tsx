import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Layout from "./components/Layout";
import MagneticCursor from "./components/MagneticCursor";
import DemoBanner from "./components/DemoBanner";
import Landing from "./pages/Landing";
import Overview from "./pages/Overview";
import SessionsList from "./pages/SessionsList";
import SessionDetail from "./pages/SessionDetail";
import { useAppStore } from "./store/app";

function AppShell() {
  const fetchSessions = useAppStore((s) => s.fetchSessions);
  const fetchStats = useAppStore((s) => s.fetchStats);
  const location = useLocation();

  useEffect(() => {
    void fetchSessions();
    void fetchStats();

    const onFocus = () => {
      void fetchSessions();
      void fetchStats();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchSessions, fetchStats]);

  return (
    <>
      <Layout>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route index element={<Overview />} />
            <Route path="sessions" element={<SessionsList />} />
            <Route path="sessions/:id" element={<SessionDetail />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </AnimatePresence>
      </Layout>
      <MagneticCursor />
      <DemoBanner />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app/*" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
