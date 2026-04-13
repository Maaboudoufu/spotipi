import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { requireAuth, requireRole } from "../middleware/auth";
import * as spotifyService from "../modules/spotify/service";
import { logAudit } from "../modules/audit/service";
import { config } from "../config";

const router = Router();

// Admin: initiate Spotify OAuth
router.get("/connect", requireAuth, requireRole("admin"), (req: Request, res: Response) => {
  const state = uuid();
  // Store state in cookie for validation
  res.cookie("spotify_oauth_state", state, {
    httpOnly: true,
    maxAge: 10 * 60 * 1000,
    path: "/",
  });
  const url = spotifyService.getAuthUrl(state);
  res.json({ url });
});

// OAuth callback
router.get("/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect(`${config.frontendBaseUrl}/admin/spotify?error=${error}`);
    return;
  }

  const savedState = req.cookies?.spotify_oauth_state;
  if (!state || state !== savedState) {
    res.redirect(`${config.frontendBaseUrl}/admin/spotify?error=state_mismatch`);
    return;
  }

  res.clearCookie("spotify_oauth_state", { path: "/" });

  try {
    const tokens = await spotifyService.exchangeCode(code as string);
    await spotifyService.saveConnection(tokens);
    await logAudit({
      action: "spotify_connected",
      metadata: { scope: tokens.scope },
    });
    res.redirect(`${config.frontendBaseUrl}/admin/spotify?success=true`);
  } catch (err) {
    console.error("Spotify callback error:", err);
    res.redirect(`${config.frontendBaseUrl}/admin/spotify?error=token_exchange_failed`);
  }
});

router.get("/status", requireAuth, async (_req: Request, res: Response) => {
  const status = await spotifyService.getConnectionStatus();
  res.json(status);
});

router.post("/disconnect", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  await spotifyService.disconnect();
  await logAudit({
    actorUserId: req.currentUser!.id,
    action: "spotify_disconnected",
    ipAddress: req.ip,
  });
  res.json({ ok: true });
});

export default router;
