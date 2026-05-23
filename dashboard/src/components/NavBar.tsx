import { NavLink } from "react-router-dom";
import { LayoutDashboard, List } from "lucide-react";
import { useAppStore } from "../store/app";

const navItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/sessions", label: "Sessions", icon: List, end: false },
];

export default function NavBar() {
  const count = useAppStore((s) => s.sessions.length);

  return (
    <aside
      className="flex flex-col w-48 shrink-0 border-r"
      style={{
        background: "linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-overlay) 100%)",
        borderColor: "var(--border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-4 py-5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
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
          className="text-sm font-semibold tracking-tight"
          style={{ fontFamily: "Archivo, sans-serif", color: "var(--text-primary)" }}
        >
          AgentLens
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            data-magnetic
            className="flex items-center gap-2.5 px-3 py-2 rounded text-sm"
            style={({ isActive }) => ({
              color: isActive ? "var(--text-primary)" : "var(--text-muted)",
              background: isActive
                ? "linear-gradient(90deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.02) 100%)"
                : "transparent",
              borderLeft: isActive ? "2px solid var(--score-hi)" : "2px solid transparent",
              paddingLeft: "calc(0.75rem - 0px)",
              fontFamily: "Archivo, sans-serif",
              fontWeight: 500,
              transition: "all 0.15s ease",
              borderRadius: "4px",
            })}
          >
            <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer status */}
      <div
        className="px-4 py-3 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="label">{count} session{count !== 1 ? "s" : ""}</p>
      </div>
    </aside>
  );
}
