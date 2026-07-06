import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import RoleBadge from "./RoleBadge";
import ThemeToggle from "./ThemeToggle";
import { can } from "../utils/roles";
import ToastStack from "./ToastStack";

const navItem =
  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-line/50 hover:text-ink";
const navItemActive = "bg-ink text-paper hover:bg-ink hover:text-paper";

const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const links = [
    { to: "/dashboard", label: "Dashboard", icon: "◧" },
    { to: "/notifications", label: "Notifications", icon: "◔", badge: unreadCount },
    ...(can.createOrgUser(user?.role) ? [{ to: "/team", label: "Team", icon: "◎" }] : []),
    { to: "/settings", label: "Settings", icon: "◍" },
  ];

  const sidebarContent = (
    <>
      <button
        onClick={() => {
          navigate("/dashboard");
          setMobileNavOpen(false);
        }}
        className="mb-8 flex items-center gap-2 px-2 text-left"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-flow font-display text-sm font-semibold text-white">
          T
        </span>
        <span className="font-display text-lg tracking-tight text-ink">Taskflow</span>
      </button>

      <div className="mb-8 flex items-center justify-between px-2">
        <ThemeToggle />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) => `${navItem} ${isActive ? navItemActive : ""}`}
          >
            <span className="w-4 text-center">{l.icon}</span>
            <span className="flex-1">{l.label}</span>
            {!!l.badge && (
              <span className="rounded-full bg-flow px-1.5 py-0.5 font-mono text-[10px] text-white">
                {l.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line pt-4">
        <div className="mb-2 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs text-paper">
            {user?.first_name?.[0]}
            {user?.last_name?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {user?.first_name} {user?.last_name}
            </p>
            <RoleBadge role={user?.role} />
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="w-full rounded-lg px-2 py-2 text-left text-sm text-ink-soft transition hover:bg-line/50 hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-paper">
      <ToastStack />

      {/* Mobile top bar -- only shown below lg */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper px-4 py-3 lg:hidden">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-left"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-flow font-display text-sm font-semibold text-white">
            T
          </span>
          <span className="font-display text-lg tracking-tight text-ink">Taskflow</span>
        </button>
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-soft transition hover:bg-paper-soft hover:text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer backdrop */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <div className="mx-auto flex max-w-[1400px]">
        {/* Desktop sidebar -- unchanged behaviour, always visible at lg+ */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
          {sidebarContent}
        </aside>

        {/* Mobile sidebar -- slides in as a drawer */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80vw] flex-col border-r border-line bg-paper px-4 py-6 transition-transform duration-300 ease-out lg:hidden ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;