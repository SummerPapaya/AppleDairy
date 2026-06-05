# AGENTS.md

## Cursor Cloud specific instructions

### Repository state

- **`main`** currently contains only `README.md` (project title). There is no `package.json` on `main` yet.
- The runnable **Apple Diary** app (Node/Express + SQLite + static gallery/admin UI) lives on branch **`cursor/apple-live-photo-gallery-55f8`**. Check out that branch (or a descendant) before installing dependencies or starting the server.

### Services

| Service | Required? | Notes |
|--------|-----------|--------|
| Node.js HTTP server (`npm start` / `npm run dev`) | **Yes** | Single process; serves API, gallery, admin, and `/uploads` |
| SQLite (`data/`) | **Yes** | Created automatically on first request via `better-sqlite3` |
| External DB / Docker | No | Not used |

### Commands (after `package.json` is present)

See `README.md` on the app branch for full docs. Quick reference:

| Task | Command |
|------|---------|
| Install deps | `npm install` (or `npm ci` if lockfile present) |
| Dev server (watch) | `npm run dev` — default port **3000** (`PORT` env overrides) |
| Production start | `npm start` |
| Tests | `npm test` — placeholder only (`No tests specified`); no ESLint script in `package.json` |

### Non-obvious caveats

- **`better-sqlite3` and `sharp`** are native addons; `npm install` must succeed on the VM (Node 22 works in this environment).
- **`uploads/`** and **`data/`** are git-ignored and created at runtime; do not commit them.
- If port 3000 is in use, set `PORT` or stop the existing process (check tmux session `apple-diary-dev` if a prior agent started the server).
- Use **tmux** for long-running `npm run dev` so the session survives backgrounding.

### URLs (server running)

- Gallery: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin`
- Health: `http://localhost:3000/api/health`

### Hello-world smoke test

1. `curl -s http://localhost:3000/api/health` → `{"status":"ok",...}`
2. `POST /api/photos` with multipart `date`, `title`, `description`, `image` (see README API table), then `GET /api/photos/:date` or open the gallery in a browser.
