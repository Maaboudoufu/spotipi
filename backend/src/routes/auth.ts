import { Router, Request, Response } from "express";
import { prisma } from "../db/client";
import { verifyPassword, createSession, revokeSession } from "../modules/auth/service";
import { logAudit } from "../modules/audit/service";
import { requireAuth } from "../middleware/auth";
import { config } from "../config";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user || !user.isActive) {
    await logAudit({
      action: "login_failure",
      metadata: { username },
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
    });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await logAudit({
      actorUserId: user.id,
      action: "login_failure",
      targetType: "user",
      targetId: user.id,
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
    });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const session = await createSession(user.id, Array.isArray(req.ip) ? req.ip[0] : req.ip, req.get("user-agent"));
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await logAudit({
    actorUserId: user.id,
    action: "login_success",
    targetType: "user",
    targetId: user.id,
    ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
  });

  res.cookie("session_id", session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: config.sessionMaxAge,
    path: "/",
  });

  res.json({
    user: {
      id: user.id,
      username: user.username,
      roles: user.userRoles.map((ur) => ur.role.name),
    },
  });
});

router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  if (req.sessionId) {
    await revokeSession(req.sessionId);
    await logAudit({
      actorUserId: req.currentUser!.id,
      action: "logout",
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
    });
  }
  res.clearCookie("session_id", { path: "/" });
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  res.json({ user: req.currentUser });
});

export default router;
