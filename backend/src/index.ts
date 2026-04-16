import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import { config } from "./config";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import auditRoutes from "./routes/audit";
import playerRoutes from "./routes/player";
import searchRoutes from "./routes/search";

import { attachPiBridge } from "./modules/pi/bridge";
// Side-effect import — registers Pi event handlers on load
import "./modules/pi/events";

const app = express();

app.set("trust proxy", 1);

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
app.use("/api/player", playerRoutes);
app.use("/api/search", searchRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Serve frontend static files in production
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

const server = http.createServer(app);
attachPiBridge(server);

server.listen(config.port, () => {
  console.log(`Backend running on http://localhost:${config.port}`);
  console.log(`Pi bridge listening on ws path ${config.pi.wsPath}`);
});
