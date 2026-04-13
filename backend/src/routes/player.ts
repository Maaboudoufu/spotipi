import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { spotifyApi } from "../modules/spotify/service";
import { logAudit } from "../modules/audit/service";

const router = Router();

router.use(requireAuth);

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

export default router;
