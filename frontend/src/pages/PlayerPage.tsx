import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, YouTubeSearchResult } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function PlayerPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [displayProgressMs, setDisplayProgressMs] = useState(0);
  const [volumePercent, setVolumePercent] = useState(50);
  const searchRequestIdRef = useRef(0);
  const volumeDebounceTimerRef = useRef<number | null>(null);

  const canControl = hasRole("admin", "dj");

  const clampProgress = (value: number, max?: number) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    const bounded = Math.max(0, safeValue);
    if (!max || max <= 0) return bounded;
    return Math.min(bounded, max);
  };

  const { data: playerState, isLoading } = useQuery({
    queryKey: ["playerState"],
    queryFn: api.getPlayerState,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const { data: queueData } = useQuery({
    queryKey: ["queue"],
    queryFn: api.getQueue,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const { data: recentlyPlayed } = useQuery({
    queryKey: ["recentlyPlayed"],
    queryFn: api.getRecentlyPlayed,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const runSearch = async (query: string) => {
    const requestId = ++searchRequestIdRef.current;
    setSearching(true);
    try {
      const results = await api.search(query);
      if (requestId !== searchRequestIdRef.current) return;
      setSearchResults(results.results || []);
    } catch (e: any) {
      if (requestId !== searchRequestIdRef.current) return;
      setSearchResults([]);
      showMsg("error", e.message);
    } finally {
      if (requestId !== searchRequestIdRef.current) return;
      setSearching(false);
    }
  };

  const playMutation = useMutation({
    mutationFn: (videoId?: string | void) => api.play(videoId || undefined),
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
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const prevMutation = useMutation({
    mutationFn: api.previous,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerState"] });
      queryClient.invalidateQueries({ queryKey: ["recentlyPlayed"] });
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const queueMutation = useMutation({
    mutationFn: (videoId: string) => api.addToQueue(videoId),
    onSuccess: () => {
      showMsg("success", "Added to queue");
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["queue"] });
        queryClient.refetchQueries({ queryKey: ["playerState"] });
      }, 600);
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const removeQueueMutation = useMutation({
    mutationFn: (id: string) => api.removeFromQueue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
    onError: (e: Error) => showMsg("error", e.message),
  });

  const volumeMutation = useMutation({
    mutationFn: (nextVolume: number) => api.setVolume(nextVolume),
    onError: (e: Error) => showMsg("error", e.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerState"] });
    },
  });

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    await runSearch(q);
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      searchRequestIdRef.current += 1;
      setSearching(false);
      setSearchResults([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      await runSearch(q);
    }, 400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchQuery]);

  const duration = playerState?.durationMs || 0;
  const progress = clampProgress(displayProgressMs, duration);
  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  useEffect(() => {
    setDisplayProgressMs(clampProgress(playerState?.positionMs || 0, playerState?.durationMs));
  }, [playerState?.videoId, playerState?.positionMs, playerState?.isPlaying, playerState?.durationMs]);

  useEffect(() => {
    if (typeof playerState?.volumePercent !== "number") return;
    setVolumePercent(playerState.volumePercent);
  }, [playerState?.volumePercent]);

  useEffect(() => {
    return () => {
      if (volumeDebounceTimerRef.current) {
        window.clearTimeout(volumeDebounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!playerState?.isPlaying) return;
    if (!playerState?.durationMs) return;

    let lastTick = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTick;
      lastTick = now;
      setDisplayProgressMs((prev) => clampProgress(prev + elapsed, playerState.durationMs));
    }, 250);

    return () => window.clearInterval(timer);
  }, [playerState?.isPlaying, playerState?.durationMs, playerState?.videoId]);

  const formatTime = (ms: number) => {
    const s = Math.floor(clampProgress(ms) / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const handleVolumeChange = (value: number) => {
    const nextVolume = Math.max(0, Math.min(100, value));
    setVolumePercent(nextVolume);

    if (volumeDebounceTimerRef.current) {
      window.clearTimeout(volumeDebounceTimerRef.current);
    }

    volumeDebounceTimerRef.current = window.setTimeout(() => {
      volumeMutation.mutate(nextVolume);
    }, 200);
  };

  const queue = queueData?.queue || [];
  const recentItems = recentlyPlayed?.items || [];
  const hasNowPlaying = !!playerState?.videoId;
  const piOnline = !!playerState?.piConnected;

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Now Playing
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                piOnline
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  piOnline ? "bg-green-400 animate-pulse" : "bg-red-400"
                }`}
              />
              Pi {piOnline ? "online" : "offline"}
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-sce-accent border-t-transparent rounded-full" />
            </div>
          ) : hasNowPlaying ? (
            <div className="flex flex-col sm:flex-row gap-6">
              {playerState?.thumbnailUrl && (
                <img
                  src={playerState.thumbnailUrl}
                  alt={playerState.title || ""}
                  className="w-48 h-48 rounded-lg shadow-xl object-cover"
                />
              )}

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">{playerState?.title}</h3>
                  <p className="text-lg text-gray-400 mt-1">{playerState?.channelTitle}</p>
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
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => prevMutation.mutate()}
                        className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
                        title="Previous"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                        </svg>
                      </button>

                      {playerState?.isPlaying ? (
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

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-12">Volume</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={volumePercent}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        className="flex-1 accent-sce-accent"
                        title="Volume"
                      />
                      <span className="text-xs text-gray-400 w-9 text-right">
                        {Math.round(volumePercent)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No track currently playing</p>
              <p className="text-sm mt-1">
                {piOnline ? "Add a video to the queue to start" : "Waiting for the Pi to come online"}
              </p>
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
                placeholder="Type at least 3 characters..."
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
                  key={item.videoId}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition group"
                >
                  {item.thumbnailUrl && (
                    <img src={item.thumbnailUrl} alt="" className="w-14 h-10 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 truncate">{item.channelTitle}</p>
                  </div>
                  <button
                    onClick={() => queueMutation.mutate(item.videoId)}
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
              {queue.length ? (
                queue.slice(0, 20).map((item, i) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition group"
                  >
                    <span className="text-xs text-gray-600 w-5 text-right">{i + 1}</span>
                    {item.thumbnailUrl && (
                      <img src={item.thumbnailUrl} alt="" className="w-14 h-10 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 truncate">{item.channelTitle}</p>
                    </div>
                    <button
                      onClick={() => removeQueueMutation.mutate(item.id)}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition"
                      title="Remove from queue"
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 py-4 text-center">Queue is empty</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recently Played */}
      <div className="bg-sce-card rounded-xl border border-white/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Recently Played
          </h2>
          <span className="text-xs text-gray-500">Last 20</span>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {recentItems.length ? (
            recentItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition group"
              >
                {item.thumbnailUrl && (
                  <img src={item.thumbnailUrl} alt="" className="w-14 h-10 object-cover rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.title}</p>
                  <p className="text-xs text-gray-500 truncate">{item.channelTitle}</p>
                </div>
                <span className="text-[11px] text-gray-500 whitespace-nowrap">
                  {new Date(item.playedAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                {canControl && (
                  <button
                    onClick={() => queueMutation.mutate(item.videoId)}
                    className="opacity-0 group-hover:opacity-100 px-2.5 py-1 text-xs bg-sce-accent/20 text-sce-accent rounded-full hover:bg-sce-accent/30 transition"
                  >
                    + Queue
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">No recent playback yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
