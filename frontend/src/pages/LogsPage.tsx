import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function LogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["auditLogs", page],
    queryFn: () => api.getAuditLogs(page),
  });

  const actionColor = (action: string) => {
    if (action.includes("login_success")) return "text-green-400";
    if (action.includes("login_failure")) return "text-red-400";
    if (action.includes("play") || action.includes("pause")) return "text-blue-400";
    if (action.includes("queue")) return "text-purple-400";
    if (action.includes("user")) return "text-yellow-400";
    if (action.includes("spotify")) return "text-green-400";
    return "text-gray-400";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Audit Logs</h1>

      <div className="bg-sce-card rounded-xl border border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-sce-accent border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">
                    Time
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">
                    User
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">
                    Action
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-white">
                      {log.actorUser?.username || "system"}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-sm font-mono ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500 max-w-xs truncate">
                      {log.metadataJson || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {data && data.total > 50 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-white/5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-sm text-gray-400 hover:text-white disabled:opacity-30 transition"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">
                  Page {page} of {Math.ceil(data.total / 50)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 50 >= data.total}
                  className="text-sm text-gray-400 hover:text-white disabled:opacity-30 transition"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
