import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { spotifyApi, ensureDevice } from "../modules/spotify/service";
import { logAudit } from "../modules/audit/service";

const router = Router();

router.use(requireAuth);

router.get("/devices", async (_req: Request, res: Response) => {
  try {
    const data = (await spotifyApi("/me/player/devices")) as {
      devices: Array<{
        id: string;
        name: string;
        type: string;
        is_active: boolean;
        volume_percent: number | null;
      }>;
    };
    res.json({ devices: data?.devices || [] });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.put("/transfer", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  const { deviceId } = req.body;
  if (!deviceId) {
    res.status(400).json({ error: "Device ID required" });
    return;
  }
  try {
    await spotifyApi("/me/player", {
      method: "PUT",
      body: JSON.stringify({ device_ids: [deviceId], play: true }),
    });
    await logAudit({
      actorUserId: req.currentUser!.id,
      action: "device_transfer",
      metadata: { deviceId },
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.put("/volume", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  const rawVolume = req.body?.volumePercent;
  const volumePercent = Number(rawVolume);
  if (!Number.isFinite(volumePercent) || volumePercent < 0 || volumePercent > 100) {
    res.status(400).json({ error: "volumePercent must be between 0 and 100" });
    return;
  }

  try {
    await ensureDevice();
    await spotifyApi(`/me/player/volume?volume_percent=${Math.round(volumePercent)}`, {
      method: "PUT",
    });
    await logAudit({
      actorUserId: req.currentUser!.id,
      action: "volume_set",
      metadata: { volumePercent: Math.round(volumePercent) },
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/state", async (_req: Request, res: Response) => {
  try {
    const state = await spotifyApi("/me/player");
    res.json(state || { is_playing: false });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/play", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  try {
    await ensureDevice();
    const body = req.body.uri ? { uris: [req.body.uri] } : undefined;
    await spotifyApi("/me/player/play", {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
    await logAudit({
      actorUserId: req.currentUser!.id,
      action: "play",
      metadata: req.body.uri ? { uri: req.body.uri } : undefined,
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/pause", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  try {
    await spotifyApi("/me/player/pause", { method: "PUT" });
    await logAudit({
      actorUserId: req.currentUser!.id,
      action: "pause",
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/next", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  try {
    await ensureDevice();
    await spotifyApi("/me/player/next", { method: "POST" });
    await logAudit({
      actorUserId: req.currentUser!.id,
      action: "skip_next",
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/previous", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  try {
    await ensureDevice();
    await spotifyApi("/me/player/previous", { method: "POST" });
    await logAudit({
      actorUserId: req.currentUser!.id,
      action: "skip_previous",
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/queue", requireRole("admin", "dj"), async (req: Request, res: Response) => {
  const { uri } = req.body;
  if (!uri) {
    res.status(400).json({ error: "Track URI required" });
    return;
  }
  try {
    await ensureDevice();
    await spotifyApi(`/me/player/queue?uri=${encodeURIComponent(uri)}`, { method: "POST" });
    await logAudit({
      actorUserId: req.currentUser!.id,
      action: "queue_add",
      metadata: { uri },
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/queue", async (_req: Request, res: Response) => {
  try {
    const queue = await spotifyApi("/me/player/queue");
    res.json(queue);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/recently-played", async (_req: Request, res: Response) => {
  try {
    const data = await spotifyApi("/me/player/recently-played?limit=20");
    res.json(data || { items: [] });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/recommendations", async (_req: Request, res: Response) => {
  try {
    const recent = (await spotifyApi("/me/player/recently-played?limit=15")) as {
      items?: Array<{ track?: { id?: string; artists?: Array<{ id?: string }> } }>;
    };

    const trackSeeds = Array.from(
      new Set(
        (recent?.items || [])
          .map((item) => item.track?.id)
          .filter((id): id is string => Boolean(id))
      )
    ).slice(0, 3);

    const artistSeeds = Array.from(
      new Set(
        (recent?.items || [])
          .flatMap((item) => item.track?.artists || [])
          .map((artist) => artist.id)
          .filter((id): id is string => Boolean(id))
      )
    ).slice(0, 2);

    const params = new URLSearchParams({
      limit: "20",
      seed_tracks: trackSeeds.join(","),
      seed_artists: artistSeeds.join(","),
    });

    if (!trackSeeds.length && !artistSeeds.length) {
      const fallback = await spotifyApi("/browse/new-releases?limit=20");
      res.json({
        source: "new_releases",
        tracks: (fallback as any)?.albums?.items || [],
      });
      return;
    }

    const recommendations = await spotifyApi(`/recommendations?${params.toString()}`);
    res.json({ source: "recommendations", ...(recommendations || { tracks: [] }) });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
