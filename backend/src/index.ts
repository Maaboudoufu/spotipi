import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config } from "./config";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import auditRoutes from "./routes/audit";
import spotifyRoutes from "./routes/spotify";
import playerRoutes from "./routes/player";
import searchRoutes from "./routes/search";

const app = express();

app.use(cors({
  origin: config.frontendBaseUrl,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Rate limit login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts, please try again later" },
});

app.use("/api/auth/login", loginLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/spotify", spotifyRoutes);
app.use("/api/player", playerRoutes);
app.use("/api/search", searchRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.port, () => {
  console.log(`Backend running on http://localhost:${config.port}`);
});
