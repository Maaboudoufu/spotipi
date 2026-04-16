import { config } from "../../config";

const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YT_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

export interface YouTubeVideoDetails {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
}

// Small in-memory TTL cache to conserve the 10k/day API quota.
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
const SEARCH_TTL_MS = 5 * 60 * 1000;
const VIDEO_TTL_MS = 10 * 60 * 1000;
const searchCache = new Map<string, CacheEntry<YouTubeVideoDetails[]>>();
const videoCache = new Map<string, CacheEntry<YouTubeVideoDetails>>();

function now() {
  return Date.now();
}

function readCache<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (hit.expiresAt < now()) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  map.set(key, { value, expiresAt: now() + ttlMs });
}

export function parseISODuration(iso: string): number {
  // Supports PT#H#M#S where any section is optional, e.g. PT4M13S, PT1H2M3S, PT45S
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (parseInt(h || "0", 10) * 3600) + (parseInt(m || "0", 10) * 60) + parseInt(s || "0", 10);
}

function pickThumbnail(thumbnails: any): string {
  if (!thumbnails) return "";
  return (
    thumbnails.medium?.url ||
    thumbnails.high?.url ||
    thumbnails.default?.url ||
    thumbnails.standard?.url ||
    ""
  );
}

async function ytFetch(url: string): Promise<any> {
  if (!config.youtube.apiKey) {
    throw new Error("YOUTUBE_API_KEY is not configured");
  }
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error (${res.status}): ${body}`);
  }
  return res.json();
}

export async function getVideoDetails(ids: string[]): Promise<YouTubeVideoDetails[]> {
  if (ids.length === 0) return [];

  const missing: string[] = [];
  const cached: YouTubeVideoDetails[] = [];
  for (const id of ids) {
    const hit = readCache(videoCache, id);
    if (hit) cached.push(hit);
    else missing.push(id);
  }

  if (missing.length === 0) return cached;

  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    id: missing.join(","),
    key: config.youtube.apiKey,
  });
  const data = await ytFetch(`${YT_VIDEOS_URL}?${params.toString()}`);

  const fetched: YouTubeVideoDetails[] = (data.items || []).map((item: any) => {
    const detail: YouTubeVideoDetails = {
      videoId: item.id,
      title: item.snippet?.title || "",
      channelTitle: item.snippet?.channelTitle || "",
      thumbnailUrl: pickThumbnail(item.snippet?.thumbnails),
      durationSec: parseISODuration(item.contentDetails?.duration || "PT0S"),
    };
    writeCache(videoCache, detail.videoId, detail, VIDEO_TTL_MS);
    return detail;
  });

  // Preserve input order as much as possible
  const lookup = new Map(fetched.map((v) => [v.videoId, v]));
  const ordered: YouTubeVideoDetails[] = [];
  for (const id of ids) {
    const hit = readCache(videoCache, id) || lookup.get(id);
    if (hit) ordered.push(hit);
  }
  return ordered;
}

export async function searchWithDurations(query: string, limit = 15): Promise<YouTubeVideoDetails[]> {
  const trimmed = query.trim();
  const cacheKey = `${limit}:${trimmed.toLowerCase()}`;
  const cached = readCache(searchCache, cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: trimmed,
    maxResults: String(Math.min(Math.max(limit, 1), 50)),
    key: config.youtube.apiKey,
  });
  const data = await ytFetch(`${YT_SEARCH_URL}?${params.toString()}`);

  const ids: string[] = (data.items || [])
    .map((item: any) => item.id?.videoId)
    .filter((v: unknown): v is string => typeof v === "string" && v.length > 0);

  if (ids.length === 0) {
    writeCache(searchCache, cacheKey, [], SEARCH_TTL_MS);
    return [];
  }

  // Fetch durations in one videos.list call for accuracy
  const details = await getVideoDetails(ids);
  writeCache(searchCache, cacheKey, details, SEARCH_TTL_MS);
  return details;
}
