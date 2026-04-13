import { Request, Response, NextFunction } from "express";
import { getValidSession } from "../modules/auth/service";

declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
      currentUser?: {
        id: string;
        username: string;
        roles: string[];
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const session = await getValidSession(sessionId);
  if (!session) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  req.sessionId = sessionId;
  req.currentUser = {
    id: session.user.id,
    username: session.user.username,
    roles: session.user.userRoles.map((ur) => ur.role.name),
  };

  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const hasRole = req.currentUser.roles.some((r) => roles.includes(r));
    if (!hasRole) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
