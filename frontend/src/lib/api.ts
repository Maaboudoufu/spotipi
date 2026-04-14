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

  // Spotify
  getSpotifyStatus: () => request<SpotifyStatus>("/spotify/status"),
  connectSpotify: () => request<{ url: string }>("/spotify/connect"),
  disconnectSpotify: () => request("/spotify/disconnect", { method: "POST" }),

  // Player
  getPlayerState: () => request<SpotifyPlayerState>("/player/state"),
  play: (uri?: string) =>
    request("/player/play", { method: "POST", body: JSON.stringify(uri ? { uri } : {}) }),
  pause: () => request("/player/pause", { method: "POST" }),
  next: () => request("/player/next", { method: "POST" }),
  previous: () => request("/player/previous", { method: "POST" }),
  addToQueue: (uri: string) =>
    request("/player/queue", { method: "POST", body: JSON.stringify({ uri }) }),
  getQueue: () => request<SpotifyQueue>("/player/queue"),
  getDevices: () => request<{ devices: SpotifyDevice[] }>("/player/devices"),
  transferPlayback: (deviceId: string) =>
    request("/player/transfer", { method: "PUT", body: JSON.stringify({ deviceId }) }),
  setVolume: (volumePercent: number) =>
    request("/player/volume", {
      method: "PUT",
      body: JSON.stringify({ volumePercent }),
    }),

  // Search
  search: (q: string) => request<SpotifySearchResults>(`/search?q=${encodeURIComponent(q)}`),
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

export interface SpotifyStatus {
  connected: boolean;
  accountLabel?: string;
  spotifyUserId?: string;
  tokenExpiresAt?: string;
}

export interface SpotifyPlayerState {
  is_playing: boolean;
  item?: {
    name: string;
    uri: string;
    artists: { name: string }[];
    album: {
      name: string;
      images: { url: string; width: number; height: number }[];
    };
    duration_ms: number;
  };
  progress_ms?: number;
  device?: {
    name: string;
    volume_percent: number;
  };
}

export interface SpotifyQueue {
  currently_playing: SpotifyPlayerState["item"] | null;
  queue: SpotifyPlayerState["item"][];
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number | null;
}

export interface SpotifySearchResults {
  tracks?: { items: SpotifyPlayerState["item"][] };
  artists?: { items: { name: string; id: string; images: { url: string }[] }[] };
  albums?: { items: { name: string; id: string; images: { url: string }[] }[] };
}
