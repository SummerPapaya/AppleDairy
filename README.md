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
npm start
# → http://localhost:3000        (viewer)
# → http://localhost:3000/admin  (upload / edit studio)
# → http://localhost:3000/embed  (embedding guide + live preview)
```

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

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/photos` | List all photos (newest date first) |
| `GET` | `/api/photos/:id` | Get one |
| `POST` | `/api/photos` | Create — `multipart`: `date`, `description`, `image`, `video?` |
| `PUT` | `/api/photos/:id` | Edit fields / replace media / `removeVideo` |
| `DELETE` | `/api/photos/:id` | Delete a day's photo + files |

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
