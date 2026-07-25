# 🍎 An Apple A Day

Store apple-themed **Live Photos of the day** in a cute, clean, hand-drawn
sketch style — then show them off two ways:

- **📅 Calendar mode** — a calendar where each day's apple hangs from a little
  string; the photo is clipped into an apple shape.
- **🖼️ Gallery mode** — a photo-booth wall of **draggable, randomly scattered
  polaroids** with handwritten captions (description + date).

In both modes photos **highlight on hover** and **zoom on click**, and
**Live Photos play** (the still's short video) on hover and when zoomed in.

The viewer is **embeddable** in any website page, and the admin studio lets you
**upload & edit** each day's photo from **phone or computer**.

## Quick start

```bash
npm install
cp .env.example .env   # then set ADMIN_PASSWORD
npm start
# → http://localhost:3000        (viewer)
# → http://localhost:3000/admin  (upload / edit studio)
# → http://localhost:3000/embed  (embedding guide + live preview)
```

### Admin authentication

Set `ADMIN_PASSWORD` (and optionally `ADMIN_USER`, default `admin`) in your environment or `.env` file before starting the server. When set:

- **Write APIs** (`POST` / `PUT` / `DELETE` `/api/photos`) require a signed-in session
- **Admin studio** (`/admin`) shows a login screen
- **Read APIs** (`GET` `/api/photos`) stay public for the gallery/viewer

If `ADMIN_PASSWORD` is **not** set, auth is disabled (fine for local development only).

```bash
ADMIN_USER=admin ADMIN_PASSWORD=your-strong-password npm start
```

Never commit `.env` — it is listed in `.gitignore`.

`ffmpeg` (optional but recommended) is used to transcode uploaded Live Photo
videos (e.g. iPhone `.mov`) into web-friendly MP4. If it isn't installed, the
original video file is kept as-is.

## How it works

| Piece | Tech |
| --- | --- |
| Server / REST API | Node + Express |
| Uploads | Multer (image + optional video per day) |
| Storage | Files in `uploads/`, metadata in `data/db.json` |
| Viewer & Admin | Vanilla HTML/CSS/JS (no build step) |

### Live Photos

A “Live Photo” here is a **still image + a short looping video**. Upload both in
the admin; the viewer shows the still and plays the video on hover / zoom, with
a `LIVE` badge — mimicking Apple's Live Photos.

### Calendar crop & gallery framing

In **Admin**, after choosing a photo you can **drag and zoom** inside an apple-shaped
preview to pick exactly what appears in **calendar** thumbnails. **Gallery** polaroids
automatically match each photo's original aspect ratio.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/photos` | List all photos (newest date first) |
| `GET` | `/api/photos/:id` | Get one |
| `POST` | `/api/photos` | Create — `multipart`: `date`, `description`, `image`, `video?` **(auth required)** |
| `PUT` | `/api/photos/:id` | Edit fields / replace media / `removeVideo` **(auth required)** |
| `DELETE` | `/api/photos/:id` | Delete a day's photo + files **(auth required)** |
| `GET` | `/api/auth/status` | Check whether auth is required and if the session is valid |
| `POST` | `/api/auth/login` | Sign in — JSON: `{ "username", "password" }` |
| `POST` | `/api/auth/logout` | Sign out (clears session cookie) |

## Embedding

```html
<div id="apple-a-day"></div>
<script src="https://YOUR-HOST/embed.js"
        data-target="#apple-a-day"
        data-mode="calendar"
        data-height="640"></script>
```

Or a plain iframe: `<iframe src="https://YOUR-HOST/?mode=gallery"></iframe>`.

See `/embed` for a live preview.
