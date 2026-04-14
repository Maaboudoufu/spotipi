import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoles, setNewRoles] = useState<string[]>(["viewer"]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: api.getUsers,
  });

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const createMutation = useMutation({
    mutationFn: () => api.createUser({ username: newUsername, password: newPassword, roles: newRoles }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowCreate(false);
      setNewUsername("");
      setNewPassword("");
      setNewRoles(["viewer"]);
      showMsg("success", "User created");
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateUser(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      showMsg("success", "User updated");
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) =>
      api.setUserRoles(id, roles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      showMsg("success", "Roles updated");
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const resetPwMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.resetPassword(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setResetUserId(null);
      setResetPassword("");
      showMsg("success", "Password updated");
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const toggleRole = (name: string) => {
    setNewRoles((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-sce-accent text-sce-darker font-medium rounded-lg hover:bg-sce-accent/90 transition"
        >
          {showCreate ? "Cancel" : "Create User"}
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Create user form */}
      {showCreate && (
        <div className="bg-sce-card rounded-xl border border-white/5 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">New User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Username</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-sce-darker border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sce-accent/50 transition"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-sce-darker border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sce-accent/50 transition"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm text-gray-300 mb-2">Roles</label>
            <div className="flex gap-3">
              {["admin", "dj", "viewer"].map((role) => (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    newRoles.includes(role)
                      ? "bg-sce-accent text-sce-darker"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!newUsername || !newPassword}
            className="mt-4 px-4 py-2 bg-sce-accent text-sce-darker font-medium rounded-lg hover:bg-sce-accent/90 transition disabled:opacity-50"
          >
            Create
          </button>
        </div>
      )}

      {/* Users list */}
      <div className="bg-sce-card rounded-xl border border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-sce-accent border-t-transparent rounded-full" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">
                  Username
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">
                  Roles
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">
                  Last Login
                </th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data?.users.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-6 py-4 text-sm text-white font-medium">{user.username}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1.5">
                      {["admin", "dj", "viewer"].map((role) => (
                        <button
                          key={role}
                          onClick={() => {
                            const current = user.roles;
                            const next = current.includes(role)
                              ? current.filter((r) => r !== role)
                              : [...current, role];
                            if (next.length > 0) {
                              changeRole.mutate({ id: user.id, roles: next });
                            }
                          }}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium transition ${
                            user.roles.includes(role)
                              ? "bg-sce-accent/20 text-sce-accent"
                              : "bg-white/5 text-gray-500 hover:bg-white/10"
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        user.isActive
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {user.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {resetUserId === user.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && resetPassword)
                                resetPwMutation.mutate({ id: user.id, password: resetPassword });
                              if (e.key === "Escape") {
                                setResetUserId(null);
                                setResetPassword("");
                              }
                            }}
                            placeholder="New password"
                            autoFocus
                            className="w-32 px-2 py-1 text-xs bg-sce-darker border border-white/10 rounded text-white focus:outline-none focus:ring-1 focus:ring-sce-accent/50"
                          />
                          <button
                            onClick={() =>
                              resetPwMutation.mutate({ id: user.id, password: resetPassword })
                            }
                            disabled={!resetPassword}
                            className="text-xs text-sce-accent hover:text-sce-accent/80 transition disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setResetUserId(null);
                              setResetPassword("");
                            }}
                            className="text-xs text-gray-500 hover:text-gray-300 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setResetUserId(user.id);
                            setResetPassword("");
                          }}
                          className="text-xs text-gray-400 hover:text-white transition"
                        >
                          Edit Password
                        </button>
                      )}
                      <button
                        onClick={() =>
                          toggleActive.mutate({
                            id: user.id,
                            isActive: !user.isActive,
                          })
                        }
                        className="text-xs text-gray-400 hover:text-white transition"
                      >
                        {user.isActive ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
