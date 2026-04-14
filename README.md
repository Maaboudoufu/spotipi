# Spotipi

A web application for shared Spotify playback control. Authorized users can control a single shared Spotify account through a web UI without needing their own Spotify accounts.

![Preview](preview.png)

## Features

- **Playback controls** — play, pause, skip, previous, volume slider, device transfer
- **Queue management** — view upcoming tracks and add new ones
- **Spotify search** — search the Spotify catalog and queue tracks directly
- **Recently played & recommendations** — browse listening history and discover new tracks via Spotify recommendations
- **Role-based access** — admin, DJ, and viewer roles with appropriate permissions
- **User management** — admins can create users, assign roles, and reset passwords
- **Audit logging** — all actions logged with actor, action, target, timestamp, and IP address
- **Secure by default** — bcrypt passwords, AES-encrypted token storage, HTTP-only cookies, rate limiting

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, TanStack Query
- **Backend:** Node.js, Express, TypeScript, Prisma, SQLite
- **Monorepo** managed with npm workspaces

## Prerequisites

- Node.js (v18+)
- npm
- A [Spotify Developer](https://developer.spotify.com/dashboard) application (client ID and secret)
- Spotify Premium account (required for playback control)

## Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <repo-url>
   cd spotipi
   npm install
   ```

2. **Configure environment variables:**

   ```bash
   cp backend/.env.example backend/.env
   ```

   Edit `backend/.env` and fill in:
   - `SESSION_SECRET` — a random string for signing sessions
   - `SPOTIFY_CLIENT_ID` — from your Spotify Developer app
   - `SPOTIFY_CLIENT_SECRET` — from your Spotify Developer app
   - `TOKEN_ENCRYPTION_KEY` — a 32-character string for encrypting stored tokens

   Set your Spotify app's redirect URI to `http://localhost:3001/api/spotify/callback`.

3. **Initialize the database:**

   ```bash
   cd backend
   npx prisma db push
   npx prisma db seed
   cd ..
   ```

   This creates two default accounts:

   | Username | Password   | Role  |
   |----------|------------|-------|
   | `admin`  | `admin123` | admin |
   | `dj`     | `dj123`    | dj    |

   **Change these passwords after first login.**

4. **Start the development servers:**

   ```bash
   npm -w backend run dev
   npm -w frontend run dev
   ```

   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001

5. **Connect Spotify:** Log in as an admin and connect a Spotify account from the admin panel.

## Production

An `ecosystem.config.cjs` is included for running with PM2:

```bash
npm -w backend run build
npm -w frontend run build
pm2 start ecosystem.config.cjs
```

## Roles

| Role   | Permissions                                                    |
|--------|----------------------------------------------------------------|
| admin  | User management, Spotify connection, playback, audit logs      |
| dj     | Playback controls (play, pause, skip, queue, volume)           |
| viewer | View current playback state (read-only)                        |

## API

| Group    | Endpoints                                                                                      |
|----------|------------------------------------------------------------------------------------------------|
| Auth     | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`                           |
| Users    | `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `POST /api/users/:id/reset-password` |
| Spotify  | `GET /api/spotify/status`, `GET /api/spotify/connect`, `POST /api/spotify/disconnect`          |
| Player   | `GET /api/player/state`, `POST /api/player/play`, `POST /api/player/pause`, `POST /api/player/next`, `POST /api/player/previous`, `PUT /api/player/volume`, `GET /api/player/devices`, `PUT /api/player/transfer`, `POST /api/player/queue`, `GET /api/player/queue`, `GET /api/player/recently-played`, `GET /api/player/recommendations` |
| Search   | `GET /api/search?q=...`                                                                        |
| Audit    | `GET /api/audit-logs`                                                                          |

## Project Structure

```
spotipi/
├── frontend/          # React + Vite app
│   └── src/
│       ├── pages/     # Page components
│       ├── components/# Reusable UI components
│       └── lib/       # API client, auth context
├── backend/           # Express API server
│   └── src/
│       ├── routes/    # API route handlers
│       ├── modules/   # Business logic services
│       ├── middleware/ # Auth & role middleware
│       └── utils/     # Encryption helpers
└── prisma/            # Database schema & seed
```

## License

MIT
