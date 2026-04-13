import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();

  const navLink = (to: string, label: string) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        className={`text-sm transition-colors ${
          active
            ? "text-white font-medium"
            : "text-gray-400 hover:text-white"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-sce-darker">
      {/* Nav bar matching SCE website style: dark bg, logo left, links center, user right */}
      <nav className="bg-sce-dark/80 backdrop-blur border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo + brand */}
            <Link to="/app" className="flex items-center gap-3">
              <img src="/sce_logo.jpg" alt="SCE" className="h-9 w-9 rounded" />
              <span className="text-white font-semibold text-lg tracking-tight">
                SpotiPi
              </span>
            </Link>

            {/* Center nav */}
            <div className="hidden sm:flex items-center gap-6">
              {navLink("/app", "Player")}
              {hasRole("admin") && navLink("/admin/users", "Users")}
              {hasRole("admin") && navLink("/admin/logs", "Logs")}
              {hasRole("admin") && navLink("/admin/spotify", "Spotify")}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">
                {user?.username}
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-sce-accent/20 text-sce-accent">
                  {user?.roles[0]}
                </span>
              </span>
              <button
                onClick={logout}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex items-center gap-4 px-4 pb-3">
          {navLink("/app", "Player")}
          {hasRole("admin") && navLink("/admin/users", "Users")}
          {hasRole("admin") && navLink("/admin/logs", "Logs")}
          {hasRole("admin") && navLink("/admin/spotify", "Spotify")}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
