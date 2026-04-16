import { prisma } from "../../db/client";
import type { YouTubeVideoDetails } from "../youtube/service";

export interface QueueItemDTO {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
  addedByUsername: string | null;
  createdAt: string;
}

function toDTO(row: {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
  createdAt: Date;
  addedBy?: { username: string } | null;
}): QueueItemDTO {
  return {
    id: row.id,
    videoId: row.videoId,
    title: row.title,
    channelTitle: row.channelTitle,
    thumbnailUrl: row.thumbnailUrl,
    durationSec: row.durationSec,
    addedByUsername: null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function populateAddedBy(rows: Array<{ addedByUserId: string | null }>): Promise<Map<string, string>> {
  const ids = Array.from(new Set(rows.map((r) => r.addedByUserId).filter((v): v is string => !!v)));
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true },
  });
  return new Map(users.map((u) => [u.id, u.username]));
}

export async function listQueue(): Promise<QueueItemDTO[]> {
  const rows = await prisma.queueItem.findMany({
    where: { playedAt: null },
    orderBy: { position: "asc" },
  });
  const users = await populateAddedBy(rows);
  return rows.map((row) => ({
    ...toDTO(row),
    addedByUsername: row.addedByUserId ? users.get(row.addedByUserId) ?? null : null,
  }));
}

async function nextPosition(): Promise<number> {
  const top = await prisma.queueItem.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (top?.position ?? 0) + 1;
}

export async function enqueue(video: YouTubeVideoDetails, userId?: string): Promise<QueueItemDTO> {
  const position = await nextPosition();
  const row = await prisma.queueItem.create({
    data: {
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.channelTitle,
      thumbnailUrl: video.thumbnailUrl,
      durationSec: video.durationSec,
      addedByUserId: userId ?? null,
      position,
    },
  });
  return toDTO(row);
}

export async function enqueueFront(video: YouTubeVideoDetails, userId?: string): Promise<QueueItemDTO> {
  // Get the minimum position among unplayed items and insert below it
  const first = await prisma.queueItem.findFirst({
    where: { playedAt: null },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const position = (first?.position ?? 1) - 1;
  const row = await prisma.queueItem.create({
    data: {
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.channelTitle,
      thumbnailUrl: video.thumbnailUrl,
      durationSec: video.durationSec,
      addedByUserId: userId ?? null,
      position,
    },
  });
  return toDTO(row);
}

export async function removeQueueItem(id: string): Promise<boolean> {
  const result = await prisma.queueItem.deleteMany({ where: { id, playedAt: null } });
  return result.count > 0;
}

export async function popNext(): Promise<QueueItemDTO | null> {
  const row = await prisma.queueItem.findFirst({
    where: { playedAt: null },
    orderBy: { position: "asc" },
  });
  if (!row) return null;
  const updated = await prisma.queueItem.update({
    where: { id: row.id },
    data: { playedAt: new Date() },
  });
  return toDTO(updated);
}

export async function clearQueue(): Promise<void> {
  await prisma.queueItem.deleteMany({ where: { playedAt: null } });
}
