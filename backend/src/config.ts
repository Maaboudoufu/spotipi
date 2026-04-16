import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  sessionSecret: process.env.SESSION_SECRET || "change-me",
  sessionMaxAge: 24 * 60 * 60 * 1000, // 24 hours
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3001",
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || "http://localhost:5173",
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || "",
  },
  pi: {
    bridgeSecret: process.env.PI_BRIDGE_SECRET || "change-me",
    wsPath: process.env.PI_WS_PATH || "/ws/pi",
  },
};
