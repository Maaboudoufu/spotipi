# plan.md

## Goal
Build a web UI that lets authorized users control **one shared Spotify account**:
- play music
- pause music
- view current playback
- add tracks to queue
- optionally search tracks/albums/artists

Users **do not** log into Spotify with their own accounts.
They log into **our app** with a username and password.

---

## Recommended stack

### Frontend
- **React**
- **TypeScript**
- **Vite**
- **React Router**
- **TanStack Query** for API state
- **Tailwind CSS** for UI styling

### Backend
- **Node.js**
- **TypeScript**
- **Express** or **Fastify**
- **Prisma ORM**

### Database
- **PostgreSQL** for real use
- **SQLite** only for local dev or a fast prototype

### Auth
- App-owned **username/password login**
- Password hashing with **bcrypt** or **argon2**
- **HTTP-only cookie sessions** preferred for MVP

### Logging / roles
- Database-backed roles and audit logs

### Spotify integration
- Backend connects to **one shared Spotify account**
- Use **Spotify Authorization Code Flow** on the backend
- Store Spotify refresh token securely in the database or secrets store
- Backend refreshes Spotify access tokens when needed

---

## What not to use for MVP
- **No Python**
  - Not needed for this product
  - Adds complexity without helping the core use case
- **No direct Spotify auth in the React app**
  - This is a shared-account controller, so Spotify auth should live on the backend
- **No SQLite in production**
  - Fine for local testing, but use PostgreSQL for multiple users, roles, and logs

---

## Why this architecture
This app has **two different auth systems**:

1. **Your app auth**
   - users sign in with username/password
   - your backend checks roles and permissions

2. **Spotify auth**
   - only the owner/admin connects the shared Spotify account
   - backend stores the Spotify refresh token
   - all playback actions go through the backend

So the flow is:
1. User logs into your app
2. React calls your backend
3. Backend checks role/permission
4. Backend calls Spotify on behalf of the shared account
5. Backend writes an audit log entry

---

## MVP feature set

### Auth
- login page
- logout
- session handling
- password hashing
- protected routes

### User management
- admin can create users
- admin can disable users
- admin can assign roles

### Roles
Start simple:
- **admin**
  - manage users
  - connect Spotify account
  - play/pause/queue
  - view logs
- **dj**
  - play/pause/queue/search
- **viewer**
  - read-only playback view

### Spotify controls
- show current track
- show playback status
- play/resume
- pause
- add track to queue
- optional: search Spotify catalog
- optional: skip next / previous
- optional: volume control

### Logs
Audit log entries for:
- login success/failure
- logout
- user created/updated/disabled
- role changed
- Spotify account connected/refreshed
- play
- pause
- queue add
- search requests (optional)

---

## Suggested database schema

### users
- id
- username
- password_hash
- is_active
- created_at
- updated_at
- last_login_at

### roles
- id
- name

### user_roles
- user_id
- role_id

### sessions
- id
- user_id
- expires_at
- created_at
- revoked_at
- ip_address
- user_agent

### audit_logs
- id
- actor_user_id (nullable)
- action
- target_type
- target_id
- metadata_json
- created_at
- ip_address

### spotify_connection
- id
- account_label
- spotify_user_id
- access_token_encrypted
- refresh_token_encrypted
- token_expires_at
- scope
- created_at
- updated_at

Notes:
- Encrypt Spotify tokens at rest.
- You may only need one `spotify_connection` row for the shared account.

---

## API design

### Auth routes
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### User admin routes
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `PATCH /api/users/:id/roles`
- `POST /api/users/:id/reset-password`

### Audit routes
- `GET /api/audit-logs`

### Spotify admin routes
- `GET /api/spotify/connect`
- `GET /api/spotify/callback`
- `GET /api/spotify/status`
- `POST /api/spotify/disconnect`

### Spotify player routes
- `GET /api/player/state`
- `POST /api/player/play`
- `POST /api/player/pause`
- `POST /api/player/queue`
- `GET /api/player/queue`
- `GET /api/search?q=`

---

## Frontend pages

### Public
- `/login`

### Protected
- `/app`
  - now playing
  - playback controls
  - queue form
  - optional search results
- `/admin/users`
- `/admin/logs`
- `/admin/spotify`

---

## UI behavior

### Login page
- username field
- password field
- sign in button
- generic error message on failure

### Main player page
- current track info
- album art
- artist name
- playback state
- play button
- pause button
- add-to-queue input/search
- optional queue preview

### Admin pages
- user list
- create/edit user
- assign roles
- view audit logs
- connect/reconnect Spotify account

---

## Security requirements
- Hash passwords with **argon2** or **bcrypt**
- Use **HTTP-only**, **secure** cookies
- Add CSRF protection if using cookie auth
- Validate all input on backend
- Enforce role checks on every protected API route
- Rate-limit login endpoint
- Lock or slow down repeated failed logins
- Never expose Spotify client secret to frontend
- Encrypt Spotify refresh token at rest
- Store secrets in environment variables / secret manager

---

## Spotify implementation notes
- Use Spotify auth on the **backend only** for the shared account
- Admin should complete the Spotify connect flow once
- Backend should refresh access tokens automatically
- Handle “no active device” gracefully
- Expect some playback endpoints to require a **Spotify Premium** account
- Queue/playback actions should return clear error messages if Spotify rejects the request

---

## MVP development order

### Phase 1: project setup
- create frontend and backend apps
- configure TypeScript
- set up PostgreSQL + Prisma
- add env handling
- add lint/format scripts

### Phase 2: app auth
- user model
- password hashing
- login/logout
- session cookies
- protected routes

### Phase 3: roles + admin
- roles tables
- permission middleware
- create/list/update users
- assign roles

### Phase 4: audit logging
- log auth events
- log admin events
- log player actions
- build logs page

### Phase 5: Spotify connection
- implement backend OAuth flow
- save shared account tokens securely
- token refresh helper
- connection status endpoint

### Phase 6: player controls
- current playback state
- play
- pause
- queue add
- queue view/search if desired

### Phase 7: polish
- friendly error messages
- loading states
- empty states
- permission-aware UI
- basic tests

---

## Suggested repo structure

```text
root/
  frontend/
    src/
      app/
      components/
      features/
      pages/
      lib/
  backend/
    src/
      routes/
      middleware/
      services/
      modules/
        auth/
        users/
        roles/
        spotify/
        audit/
      db/
      utils/
  prisma/
    schema.prisma
```

---

## Environment variables

### Backend
- `DATABASE_URL`
- `SESSION_SECRET`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `TOKEN_ENCRYPTION_KEY`
- `APP_BASE_URL`
- `FRONTEND_BASE_URL`

### Frontend
- `VITE_API_BASE_URL`

---

## Good MVP decisions
- Use **PostgreSQL** now if this is meant to be real and multi-user
- Use **SQLite** only if you need the fastest local prototype
- Keep roles simple at first: `admin`, `dj`, `viewer`
- Keep auth session-based for MVP instead of adding JWT complexity
- Only one shared Spotify connection for v1

---

## Future upgrades
- password reset flow
- 2FA for admins
- invite-based user creation
- per-role action matrix
- searchable/filterable audit logs
- multi-room support
- multiple Spotify accounts
- real-time updates with WebSockets
- playlist management

---

## Clear recommendation
Use:
- **React + TypeScript**
- **Node.js + TypeScript**
- **PostgreSQL**
- **Prisma**
- **session cookies**
- **backend-owned Spotify Authorization Code Flow**

Do **not** use Python.
Use **SQLite only for local prototype/dev**, not for the real multi-user app.

---

## Acceptance criteria for MVP
- users can log in with username/password
- admins can create users and assign roles
- non-authorized users cannot access protected routes
- backend stores and refreshes the shared Spotify account token
- authorized users can play, pause, and add items to queue
- all important user and player actions are written to audit logs
- UI clearly shows success/error states
