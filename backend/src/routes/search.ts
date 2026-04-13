import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { spotifyApi } from "../modules/spotify/service";

const router = Router();

router.get("/", requireAuth, requireRole("admin", "dj"), async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q) {
    res.status(400).json({ error: "Search query required" });
    return;
  }

  try {
    const params = new URLSearchParams({
      q,
      type: "track,artist,album",
      limit: "20",
    });
    const results = await spotifyApi(`/search?${params.toString()}`);
    res.json(results);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
