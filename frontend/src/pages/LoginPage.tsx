import { useState, FormEvent } from "react";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sce-dark to-sce-darker flex flex-col">
      {/* Top bar matching SCE site */}
      <nav className="flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-3">
          <img src="/sce_logo.jpg" alt="SCE" className="h-10 w-10 rounded" />
          <span className="text-white font-semibold text-xl tracking-tight">SpotiPi</span>
        </div>
      </nav>

      {/* Hero section with login - mimicking SCE website layout */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Title section like SCE hero */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-white mb-2">
              SpotiPi
            </h1>
            <p className="text-gray-400">SCE Music Controller</p>
          </div>

          {/* Login card */}
          <div className="bg-sce-card rounded-xl p-8 shadow-2xl border border-white/5">
            <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-sce-darker border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sce-accent/50 focus:border-sce-accent/50 transition"
                  placeholder="Enter username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-sce-darker border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sce-accent/50 focus:border-sce-accent/50 transition"
                  placeholder="Enter password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-sce-accent text-sce-darker font-semibold rounded-lg hover:bg-sce-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer matching SCE site */}
      <footer className="py-6 text-center text-sm text-gray-500">
        SpotiPi - SCE Music Controller
      </footer>
    </div>
  );
}
