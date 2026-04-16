import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import Layout from "../components/Layout";
import LoginPage from "../pages/LoginPage";
import PlayerPage from "../pages/PlayerPage";
import UsersPage from "../pages/UsersPage";
import LogsPage from "../pages/LogsPage";

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sce-darker">
        <div className="animate-spin h-8 w-8 border-2 border-sce-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !user.roles.some((r) => roles.includes(r))) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sce-darker">
        <div className="animate-spin h-8 w-8 border-2 border-sce-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/app" replace /> : <LoginPage />}
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout><PlayerPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute roles={["admin"]}>
            <Layout><UsersPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/logs"
        element={
          <ProtectedRoute roles={["admin"]}>
            <Layout><LogsPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={user ? "/app" : "/login"} replace />} />
    </Routes>
  );
}
