import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../db/client";
import { logAudit } from "../modules/audit/service";
import { getVideoDetails } from "../modules/youtube/service";
import {
  clearNowPlaying,
  getState,
  setNowPlaying,
  updateState,
} from "../modules/player/state";
import {
  enqueue,
  enqueueFront,
  listQueue,
  popNext,
  removeQueueItem,
} from "../modules/player/queue";
import { isPiConnected, sendCommand } from "../modules/pi/bridge";
import { advanceToNext } from "../modules/pi/events";

const router = Router();

router.use(requireAuth);

function clientIp(req: Request): string | undefined {
  return Array.isArray(req.ip) ? req.ip[0] : req.ip;
}

async function resolveVideo(videoId: string) {
  const details = await getVideoDetails([videoId]);
  if (details.length === 0) throw new Error(`Video not found: ${videoId}`);
  return details[0];
}

async function startPlaying(videoId: string) {
  const video = await resolveVideo(videoId);
  await setNowPlaying(video);
  const state = await getState();
  sendCommand({
    type: "load_and_play",
    videoId: video.videoId,
    volumePercent: state.volumePercent,
  });
  return video;
}

router.get("/state", async (_req: Request, res: Response) => {
  const state = await getState();
  res.json(state);
});

router.get("/queue", async (_req: Request, res: Response) => {
  const [state, queue] = await Promise.all([getState(), listQueue()]);
  res.json({ currentlyPlaying: state, queue });
});

router.post("/queue", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  const videoId = typeof req.body?.videoId === "string" ? req.body.videoId : "";
  if (!videoId) {
    res.status(400).json({ error: "videoId required" });
    return;
  }
  try {
    const video = await resolveVideo(videoId);
    const item = await enqueue(video, req.currentUser!.id);
    await logAudit({
      actorUserId: req.currentUser!.id,
      action: "queue_add",
      metadata: { videoId: video.videoId, title: video.title },
      ipAddress: clientIp(req),
    });

    // Auto-play if nothing is currently playing and the Pi is connected
    const state = await getState();
    if (!state.videoId && isPiConnected()) {
      const next = await popNext();
      if (next) {
        await setNowPlaying({
          videoId: next.videoId,
          title: next.title,
          channelTitle: next.channelTitle,
          thumbnailUrl: next.thumbnailUrl,
          durationSec: next.durationSec,
        });
        sendCommand({
          type: "load_and_play",
          videoId: next.videoId,
          volumePercent: state.volumePercent,
        });
      }
    }

    res.json({ item });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "Failed to enqueue" });
  }
});

router.delete("/queue/:id", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const removed = await removeQueueItem(id);
  if (!removed) {
    res.status(404).json({ error: "Queue item not found" });
    return;
  }
  await logAudit({
    actorUserId: req.currentUser!.id,
    action: "queue_remove",
    targetType: "queue_item",
    targetId: id,
    ipAddress: clientIp(req),
  });
  res.json({ ok: true });
});

router.post("/play", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  const videoId = typeof req.body?.videoId === "string" ? req.body.videoId : "";
  try {
    if (!isPiConnected()) {
      res.status(503).json({ error: "Pi not connected" });
      return;
    }
    if (videoId) {
      const video = await startPlaying(videoId);
      await logAudit({
        actorUserId: req.currentUser!.id,
        action: "play",
        metadata: { videoId: video.videoId, title: video.title },
        ipAddress: clientIp(req),
      });
    } else {
      sendCommand({ type: "resume" });
      await updateState({ isPlaying: true });
      await logAudit({
        actorUserId: req.currentUser!.id,
        action: "play",
        ipAddress: clientIp(req),
      });
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "Failed to play" });
  }
});

router.post("/pause", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  if (!isPiConnected()) {
    res.status(503).json({ error: "Pi not connected" });
    return;
  }
  sendCommand({ type: "pause" });
  await updateState({ isPlaying: false });
  await logAudit({
    actorUserId: req.currentUser!.id,
    action: "pause",
    ipAddress: clientIp(req),
  });
  res.json({ ok: true });
});

router.post("/next", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  if (!isPiConnected()) {
    res.status(503).json({ error: "Pi not connected" });
    return;
  }
  const advanced = await advanceToNext();
  await logAudit({
    actorUserId: req.currentUser!.id,
    action: "skip_next",
    ipAddress: clientIp(req),
  });
  res.json({ ok: true, advanced });
});

router.post("/previous", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  if (!isPiConnected()) {
    res.status(503).json({ error: "Pi not connected" });
    return;
  }
  const last = await prisma.recentlyPlayed.findFirst({
    orderBy: { playedAt: "desc" },
  });
  if (!last) {
    res.status(404).json({ error: "Nothing to go back to" });
    return;
  }

  await enqueueFront(
    {
      videoId: last.videoId,
      title: last.title,
      channelTitle: last.channelTitle,
      thumbnailUrl: last.thumbnailUrl,
      durationSec: last.durationSec,
    },
    req.currentUser!.id,
  );
  await prisma.recentlyPlayed.delete({ where: { id: last.id } });
  await advanceToNext();

  await logAudit({
    actorUserId: req.currentUser!.id,
    action: "skip_previous",
    metadata: { videoId: last.videoId, title: last.title },
    ipAddress: clientIp(req),
  });
  res.json({ ok: true });
});

router.put("/volume", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  const raw = Number(req.body?.volumePercent);
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
    res.status(400).json({ error: "volumePercent must be between 0 and 100" });
    return;
  }
  const volumePercent = Math.round(raw);
  await updateState({ volumePercent });
  sendCommand({ type: "volume", volumePercent });
  await logAudit({
    actorUserId: req.currentUser!.id,
    action: "volume_set",
    metadata: { volumePercent },
    ipAddress: clientIp(req),
  });
  res.json({ ok: true });
});

router.get("/recently-played", async (_req: Request, res: Response) => {
  const rows = await prisma.recentlyPlayed.findMany({
    orderBy: { playedAt: "desc" },
    take: 20,
  });
  const items = rows.map((row) => ({
    id: row.id,
    videoId: row.videoId,
    title: row.title,
    channelTitle: row.channelTitle,
    thumbnailUrl: row.thumbnailUrl,
    durationSec: row.durationSec,
    playedAt: row.playedAt.toISOString(),
  }));
  res.json({ items });
});

export default router;
