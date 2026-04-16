import { prisma } from "../../db/client";
import { onPiEvent, sendCommand, type PiEvent } from "./bridge";
import {
  clearNowPlaying,
  getState,
  setNowPlaying,
  updateState,
} from "../player/state";
import { popNext } from "../player/queue";
import { logAudit } from "../audit/service";

const RECENTLY_PLAYED_KEEP = 50;

async function recordRecentlyPlayed(state: Awaited<ReturnType<typeof getState>>) {
  if (!state.videoId || !state.title || !state.channelTitle) return;
  const durationSec = Math.max(0, Math.round((state.durationMs || 0) / 1000));
  await prisma.recentlyPlayed.create({
    data: {
      videoId: state.videoId,
      title: state.title,
      channelTitle: state.channelTitle,
      thumbnailUrl: state.thumbnailUrl || "",
      durationSec,
    },
  });
  // Trim old entries
  const total = await prisma.recentlyPlayed.count();
  if (total > RECENTLY_PLAYED_KEEP) {
    const toDelete = await prisma.recentlyPlayed.findMany({
      orderBy: { playedAt: "asc" },
      take: total - RECENTLY_PLAYED_KEEP,
      select: { id: true },
    });
    if (toDelete.length > 0) {
      await prisma.recentlyPlayed.deleteMany({
        where: { id: { in: toDelete.map((r) => r.id) } },
      });
    }
  }
}

export async function advanceToNext(): Promise<boolean> {
  const prev = await getState();
  if (prev.videoId) {
    await recordRecentlyPlayed(prev);
  }

  const next = await popNext();
  if (!next) {
    await clearNowPlaying();
    return false;
  }

  await setNowPlaying({
    videoId: next.videoId,
    title: next.title,
    channelTitle: next.channelTitle,
    thumbnailUrl: next.thumbnailUrl,
    durationSec: next.durationSec,
  });
  const state = await getState();
  sendCommand({
    type: "load_and_play",
    videoId: next.videoId,
    volumePercent: state.volumePercent,
  });
  return true;
}

onPiEvent(async (event: PiEvent) => {
  try {
    switch (event.type) {
      case "position":
        await updateState({
          positionMs: event.positionMs,
          durationMs: event.durationMs || undefined,
          isPlaying: true,
        });
        break;

      case "paused":
        await updateState({ isPlaying: false });
        break;

      case "resumed":
        await updateState({ isPlaying: true });
        break;

      case "ended":
        await advanceToNext();
        break;

      case "error":
        console.error("Pi reported error:", event.message);
        await logAudit({
          action: "pi_error",
          metadata: { message: event.message, videoId: event.videoId },
        });
        await updateState({ isPlaying: false });
        break;

      case "ready":
        // Pi just came online (or reconnected). Send current volume so it stays in sync.
        {
          const state = await getState();
          sendCommand({ type: "volume", volumePercent: state.volumePercent });
        }
        break;

      case "pong":
        // No-op for now
        break;
    }
  } catch (err) {
    console.error("Error handling Pi event:", err);
  }
});
