import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, SpotifyPlayerState, SpotifyDevice } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function PlayerPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyPlayerState["item"][]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDevices, setShowDevices] = useState(false);

  const canControl = hasRole("admin", "dj");

  const { data: playerState, isLoading } = useQuery({
    queryKey: ["playerState"],
    queryFn: api.getPlayerState,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const { data: queue } = useQuery({
    queryKey: ["queue"],
    queryFn: api.getQueue,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const { data: devicesData, refetch: refetchDevices } = useQuery({
    queryKey: ["devices"],
    queryFn: api.getDevices,
    enabled: showDevices,
  });

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const playMutation = useMutation({
    mutationFn: (uri?: string | void) => api.play(uri || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerState"] });
      showMsg("success", "Playing");
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const pauseMutation = useMutation({
    mutationFn: api.pause,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerState"] });
      showMsg("success", "Paused");
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const nextMutation = useMutation({
    mutationFn: api.next,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerState"] });
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const prevMutation = useMutation({
    mutationFn: api.previous,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerState"] });
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const transferMutation = useMutation({
    mutationFn: (deviceId: string) => api.transferPlayback(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerState"] });
      refetchDevices();
      showMsg("success", "Switched device");
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const queueMutation = useMutation({
    mutationFn: (uri: string) => api.addToQueue(uri),
    onSuccess: () => {
      showMsg("success", "Added to queue");
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["queue"] });
      }, 1000);
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await api.search(searchQuery);
      setSearchResults(results.tracks?.items || []);
    } catch (e: any) {
      showMsg("error", e.message);
    } finally {
      setSearching(false);
    }
  };

  const track = playerState?.item;
  const albumArt = track?.album?.images?.[0]?.url;
  const progress = playerState?.progress_ms || 0;
  const duration = track?.duration_ms || 0;
  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-8">
      {/* Status message */}
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

      {/* Now Playing Card */}
      <div className="bg-sce-card rounded-xl border border-white/5 overflow-hidden">
        <div className="p-6">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
            Now Playing
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-sce-accent border-t-transparent rounded-full" />
            </div>
          ) : track ? (
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Album art */}
              {albumArt && (
                <img
                  src={albumArt}
                  alt={track.album.name}
                  className="w-48 h-48 rounded-lg shadow-xl object-cover"
                />
              )}

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">{track.name}</h3>
                  <p className="text-lg text-gray-400 mt-1">
                    {track.artists.map((a) => a.name).join(", ")}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{track.album.name}</p>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sce-accent rounded-full transition-all duration-1000"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Playback controls */}
                {canControl && (
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => prevMutation.mutate()}
                      className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
                      title="Previous"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                      </svg>
                    </button>

                    {playerState?.is_playing ? (
                      <button
                        onClick={() => pauseMutation.mutate()}
                        className="p-3 rounded-full bg-sce-accent text-sce-darker hover:bg-sce-accent/90 transition"
                        title="Pause"
                      >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={() => playMutation.mutate()}
                        className="p-3 rounded-full bg-sce-accent text-sce-darker hover:bg-sce-accent/90 transition"
                        title="Play"
                      >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    )}

                    <button
                      onClick={() => nextMutation.mutate()}
                      className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
                      title="Next"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Device selector */}
                <div className="mt-3 relative">
                  <button
                    onClick={() => {
                      setShowDevices(!showDevices);
                      if (!showDevices) refetchDevices();
                    }}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 16c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm5-4H7V6h10v8z" />
                    </svg>
                    {playerState?.device
                      ? `Playing on: ${playerState.device.name}`
                      : "Select device"}
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </button>

                  {showDevices && (
                    <div className="absolute bottom-full mb-2 left-0 w-64 bg-sce-darker border border-white/10 rounded-lg shadow-xl z-10 overflow-hidden">
                      <div className="p-2 border-b border-white/5">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                          Available Devices
                        </p>
                      </div>
                      {devicesData?.devices?.length ? (
                        devicesData.devices.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => {
                              if (!d.is_active) transferMutation.mutate(d.id);
                              setShowDevices(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition ${
                              d.is_active ? "text-sce-accent" : "text-gray-300"
                            }`}
                          >
                            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              {d.type === "Smartphone" ? (
                                <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" />
                              ) : d.type === "Computer" ? (
                                <path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z" />
                              ) : (
                                <path d="M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 16c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm5-4H7V6h10v8z" />
                              )}
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{d.name}</p>
                              <p className="text-xs text-gray-500">{d.type}</p>
                            </div>
                            {d.is_active && (
                              <span className="text-xs text-sce-accent">Active</span>
                            )}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-4 text-xs text-gray-500 text-center">
                          No devices found
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No track currently playing</p>
              <p className="text-sm mt-1">Start playback on a Spotify device to see it here</p>
            </div>
          )}
        </div>
      </div>

      {/* Search + Queue (for admin/dj) */}
      {canControl && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Search */}
          <div className="bg-sce-card rounded-xl border border-white/5 p-6">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              Search & Add to Queue
            </h2>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search for tracks..."
                className="flex-1 px-4 py-2.5 bg-sce-darker border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sce-accent/50 transition"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2.5 bg-sce-accent text-sce-darker font-medium rounded-lg hover:bg-sce-accent/90 transition disabled:opacity-50"
              >
                {searching ? "..." : "Search"}
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {searchResults.map((item) => (
                <div
                  key={item?.uri}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition group"
                >
                  {item?.album?.images?.[2]?.url && (
                    <img
                      src={item.album.images[2].url}
                      alt=""
                      className="w-10 h-10 rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{item?.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {item?.artists?.map((a) => a.name).join(", ")}
                    </p>
                  </div>
                  <button
                    onClick={() => item?.uri && queueMutation.mutate(item.uri)}
                    className="opacity-0 group-hover:opacity-100 px-3 py-1 text-xs bg-sce-accent/20 text-sce-accent rounded-full hover:bg-sce-accent/30 transition"
                  >
                    + Queue
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Queue preview */}
          <div className="bg-sce-card rounded-xl border border-white/5 p-6">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              Up Next
            </h2>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {queue?.queue?.length ? (
                queue.queue.slice(0, 20).map((item, i) => (
                  <div key={`${item?.uri}-${i}`} className="flex items-center gap-3 p-2">
                    <span className="text-xs text-gray-600 w-5 text-right">{i + 1}</span>
                    {item?.album?.images?.[2]?.url && (
                      <img src={item.album.images[2].url} alt="" className="w-10 h-10 rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item?.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {item?.artists?.map((a) => a.name).join(", ")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 py-4 text-center">Queue is empty</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
