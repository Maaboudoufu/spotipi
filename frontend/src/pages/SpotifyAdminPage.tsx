import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSearchParams } from "react-router-dom";

export default function SpotifyAdminPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const callbackSuccess = searchParams.get("success");
  const callbackError = searchParams.get("error");

  const { data: status, isLoading } = useQuery({
    queryKey: ["spotifyStatus"],
    queryFn: api.getSpotifyStatus,
  });

  const connectMutation = useMutation({
    mutationFn: api.connectSpotify,
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: api.disconnectSpotify,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spotifyStatus"] });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Spotify Connection</h1>

      {callbackSuccess && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          Spotify account connected successfully!
        </div>
      )}

      {callbackError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          Error connecting Spotify: {callbackError}
        </div>
      )}

      <div className="bg-sce-card rounded-xl border border-white/5 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-sce-accent border-t-transparent rounded-full" />
          </div>
        ) : status?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white font-medium">Connected</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Account</p>
                <p className="text-white mt-1">{status.accountLabel}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Spotify User ID</p>
                <p className="text-white mt-1">{status.spotifyUserId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Token Expires</p>
                <p className="text-white mt-1">
                  {status.tokenExpiresAt
                    ? new Date(status.tokenExpiresAt).toLocaleString()
                    : "Unknown"}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => connectMutation.mutate()}
                className="px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition text-sm"
              >
                Reconnect
              </button>
              <button
                onClick={() => disconnectMutation.mutate()}
                className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition text-sm"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">No Spotify account connected</p>
            <p className="text-sm text-gray-500 mb-6">
              Connect a Spotify Premium account to enable playback controls.
            </p>
            <button
              onClick={() => connectMutation.mutate()}
              className="px-6 py-2.5 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition"
            >
              Connect Spotify Account
            </button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-sce-card rounded-xl border border-white/5 p-6">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          Setup Instructions
        </h2>
        <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside">
          <li>Create a Spotify app at developer.spotify.com</li>
          <li>Set the redirect URI to your backend callback URL</li>
          <li>Add your Client ID and Secret to the backend .env file</li>
          <li>Click "Connect Spotify Account" and authorize</li>
          <li>Make sure a Spotify device is active for playback to work</li>
        </ol>
      </div>
    </div>
  );
}
