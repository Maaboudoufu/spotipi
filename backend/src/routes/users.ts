import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { createUser, listUsers, updateUser, setUserRoles, resetUserPassword } from "../modules/users/service";
import { logAudit } from "../modules/audit/service";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", async (_req: Request, res: Response) => {
  const users = await listUsers();
  res.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      isActive: u.isActive,
      roles: u.userRoles.map((ur) => ur.role.name),
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    })),
  });
});

router.post("/", async (req: Request, res: Response) => {
  const { username, password, roles } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  try {
    const user = await createUser(username, password, roles || ["viewer"]);
    await logAudit({
      actorUserId: req.currentUser!.id,
      action: "user_created",
      targetType: "user",
      targetId: user.id,
      metadata: { username, roles: roles || ["viewer"] },
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
    });
    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        roles: user.userRoles.map((ur) => ur.role.name),
      },
    });
  } catch (e: any) {
    if (e.code === "P2002") {
      res.status(409).json({ error: "Username already exists" });
      return;
    }
    throw e;
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { username, isActive } = req.body;
  const user = await updateUser(id, { username, isActive });
  await logAudit({
    actorUserId: req.currentUser!.id,
    action: "user_updated",
    targetType: "user",
    targetId: id,
    metadata: { username, isActive },
    ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
  });
  res.json({
    user: {
      id: user.id,
      username: user.username,
      isActive: user.isActive,
      roles: user.userRoles.map((ur) => ur.role.name),
    },
  });
});

router.patch("/:id/roles", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { roles } = req.body;
  if (!Array.isArray(roles)) {
    res.status(400).json({ error: "roles must be an array" });
    return;
  }
  const user = await setUserRoles(id, roles);
  await logAudit({
    actorUserId: req.currentUser!.id,
    action: "role_changed",
    targetType: "user",
    targetId: id,
    metadata: { roles },
    ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
  });
  res.json({ user });
});

router.post("/:id/reset-password", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: "Password required" });
    return;
  }
  await resetUserPassword(id, password);
  await logAudit({
    actorUserId: req.currentUser!.id,
    action: "password_reset",
    targetType: "user",
    targetId: id,
    ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
  });
  res.json({ ok: true });
});

export default router;
