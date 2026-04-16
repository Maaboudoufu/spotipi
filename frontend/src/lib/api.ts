const API_BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ user: AppUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request<{ user: AppUser }>("/auth/me"),

  // Users
  getUsers: () => request<{ users: AppUserFull[] }>("/users"),
  createUser: (data: { username: string; password: string; roles: string[] }) =>
    request("/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: { username?: string; isActive?: boolean }) =>
    request(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  setUserRoles: (id: string, roles: string[]) =>
    request(`/users/${id}/roles`, { method: "PATCH", body: JSON.stringify({ roles }) }),
  resetPassword: (id: string, password: string) =>
    request(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),

  // Audit
  getAuditLogs: (page = 1) =>
    request<{ logs: AuditLogEntry[]; total: number; page: number }>(`/audit-logs?page=${page}`),

  // Player
  getPlayerState: () => request<PlayerState>("/player/state"),
  play: (videoId?: string) =>
    request("/player/play", {
      method: "POST",
      body: JSON.stringify(videoId ? { videoId } : {}),
    }),
  pause: () => request("/player/pause", { method: "POST" }),
  next: () => request("/player/next", { method: "POST" }),
  previous: () => request("/player/previous", { method: "POST" }),
  addToQueue: (videoId: string) =>
    request<{ item: QueueItem }>("/player/queue", {
      method: "POST",
      body: JSON.stringify({ videoId }),
    }),
  removeFromQueue: (id: string) =>
    request(`/player/queue/${id}`, { method: "DELETE" }),
  getQueue: () => request<QueueResponse>("/player/queue"),
  setVolume: (volumePercent: number) =>
    request("/player/volume", {
      method: "PUT",
      body: JSON.stringify({ volumePercent }),
    }),
  getRecentlyPlayed: () =>
    request<{ items: RecentlyPlayedItem[] }>("/player/recently-played"),

  // Search
  search: (q: string) =>
    request<{ results: YouTubeSearchResult[] }>(`/search?q=${encodeURIComponent(q)}`),
};

// Types
export interface AppUser {
  id: string;
  username: string;
  roles: string[];
}

export interface AppUserFull extends AppUser {
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  actorUser: { id: string; username: string } | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadataJson: string | null;
  createdAt: string;
  ipAddress: string | null;
}

export interface PlayerState {
  videoId: string | null;
  title: string | null;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationMs: number;
  positionMs: number;
  isPlaying: boolean;
  volumePercent: number;
  piConnected: boolean;
}

export interface QueueItem {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
  addedByUsername: string | null;
  createdAt: string;
}

export interface QueueResponse {
  currentlyPlaying: PlayerState;
  queue: QueueItem[];
}

export interface RecentlyPlayedItem {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
  playedAt: string;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
}
