import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAuditLogs } from "../modules/audit/service";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const result = await getAuditLogs(page, limit);
  res.json(result);
});

export default router;
