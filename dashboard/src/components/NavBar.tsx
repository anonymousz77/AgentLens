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
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-4 py-5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true">
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
            className={({ isActive }) =>
              [
                "flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors duration-100",
                isActive
                  ? "text-primary bg-raised"
                  : "text-muted hover:text-primary hover:bg-raised",
              ].join(" ")
            }
            style={({ isActive }) => ({
              color: isActive ? "var(--text-primary)" : "var(--text-muted)",
              background: isActive ? "var(--bg-raised)" : "transparent",
              fontFamily: "Archivo, sans-serif",
              fontWeight: 500,
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
