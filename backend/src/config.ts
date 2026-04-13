import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  sessionSecret: process.env.SESSION_SECRET || "change-me",
  sessionMaxAge: 24 * 60 * 60 * 1000, // 24 hours
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3001/api/spotify/callback",
  },
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || "change-me-32-char-encryption-key",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3001",
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || "http://localhost:5173",
};
