import { prisma } from "../../db/client";
import { config } from "../../config";
import { encrypt, decrypt } from "../../utils/encryption";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
].join(" ");

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.spotify.clientId,
    scope: SCOPES,
    redirect_uri: config.spotify.redirectUri,
    state,
  });
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.spotify.redirectUri,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token exchange failed: ${err}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  }>;
}

async function refreshAccessToken(connection: { id: string; refreshTokenEncrypted: string }) {
  const refreshToken = decrypt(connection.refreshTokenEncrypted);

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh Spotify token");

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const updatedRefreshToken = data.refresh_token || refreshToken;

  await prisma.spotifyConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encrypt(data.access_token),
      refreshTokenEncrypted: encrypt(updatedRefreshToken),
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

export async function getAccessToken(): Promise<string | null> {
  const connection = await prisma.spotifyConnection.findFirst();
  if (!connection) return null;

  if (connection.tokenExpiresAt < new Date(Date.now() + 60_000)) {
    return refreshAccessToken(connection);
  }

  return decrypt(connection.accessTokenEncrypted);
}

export async function saveConnection(tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}) {
  // Get Spotify user profile
  const profileRes = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await profileRes.json()) as { id: string; display_name?: string };

  // Upsert: delete old, create new
  await prisma.spotifyConnection.deleteMany();
  return prisma.spotifyConnection.create({
    data: {
      accountLabel: profile.display_name || profile.id,
      spotifyUserId: profile.id,
      accessTokenEncrypted: encrypt(tokens.access_token),
      refreshTokenEncrypted: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
    },
  });
}

export async function getConnectionStatus() {
  const conn = await prisma.spotifyConnection.findFirst();
  if (!conn) return { connected: false };
  return {
    connected: true,
    accountLabel: conn.accountLabel,
    spotifyUserId: conn.spotifyUserId,
    tokenExpiresAt: conn.tokenExpiresAt,
  };
}

export async function disconnect() {
  await prisma.spotifyConnection.deleteMany();
}

export async function ensureDevice(): Promise<void> {
  // Check if there's already an active device
  const state = await spotifyApi("/me/player");
  if (state?.device) return;

  // No active device — find the target device and transfer playback
  const { devices } = (await spotifyApi("/me/player/devices")) as {
    devices: Array<{ id: string; name: string; is_active: boolean }>;
  };

  if (!devices || devices.length === 0) {
    throw new Error("No Spotify devices available. Is Raspotify running?");
  }

  const targetName = config.spotifyDeviceName;
  const device = targetName
    ? devices.find((d) => d.name.toLowerCase().includes(targetName.toLowerCase()))
    : devices[0];

  if (!device) {
    throw new Error(`Spotify device "${targetName}" not found. Available: ${devices.map((d) => d.name).join(", ")}`);
  }

  await spotifyApi("/me/player", {
    method: "PUT",
    body: JSON.stringify({ device_ids: [device.id], play: false }),
  });

  // Give Spotify a moment to activate the device
  await new Promise((r) => setTimeout(r, 500));
}

export async function spotifyApi(endpoint: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("No Spotify connection");

  const res = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify API error (${res.status}): ${err}`);
  }

  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
