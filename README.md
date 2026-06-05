# 🍎 An Apple A Day

An apple-themed live photo diary app with a hand-drawn illustration style. Upload one special photo per day with descriptions, then display them in a beautiful **Calendar mode** or **Polaroid Gallery mode** — both fully embeddable in any website.

---

## Features

### Gallery (Frontend)
- **Calendar Mode** — A monthly calendar with hand-drawn apple decorations. Days with photos display small hanging polaroid frames (with a string + pin). Hover to enlarge, click to zoom.
- **Gallery Mode** — A photo booth cork-board with randomly placed, tape-adorned polaroid frames. Handwriting fonts for captions. Shuffle to re-scatter. Hover to highlight, click to zoom.
- **Live Photo support** — When zoomed in, a "▶ Play Live Photo" button toggles between still image and the motion video.
- **Lightbox** — Full-screen zoom viewer with keyboard navigation (← →, Esc) and swipe support on mobile.
- **Embeddable** — Drop the gallery into any page via `<iframe>`.

### Admin Panel (Backend)
- Upload still image + optional Live Photo video per date
- Edit title, description, image, or video for any existing date
- Delete entries with confirmation
- Drag-and-drop upload zones with file preview
- Mobile-friendly responsive layout

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js + Express |
| Database | SQLite (via `better-sqlite3`) |
| File uploads | Multer |
| Image thumbnails | Sharp |
| Frontend | Vanilla JS + CSS |
| Fonts | Google Fonts (Caveat, Reenie Beanie, Nunito) |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the server

```bash
npm start
# or with auto-reload:
npm run dev
```

### 3. Open in browser

| URL | Description |
|-----|-------------|
| `http://localhost:3000/` | Public gallery (embeddable) |
| `http://localhost:3000/admin` | Admin panel |

---

## Embedding in Your Website

Add to any HTML page:

```html
<iframe
  src="https://your-domain.com/"
  width="100%"
  height="700px"
  style="border:none; border-radius:12px;"
  title="Apple Diary"
  loading="lazy"
></iframe>
```

Or load a specific default view by appending `?mode=calendar` or `?mode=gallery`:

```html
<!-- Start in Gallery mode -->
<iframe src="https://your-domain.com/?mode=gallery" width="100%" height="700px" style="border:none;"></iframe>
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/photos` | List all photos (optional `?year=&month=`) |
| `GET` | `/api/photos/:date` | Get photo for a specific date (YYYY-MM-DD) |
| `POST` | `/api/photos` | Upload new photo (multipart: `date`, `title`, `description`, `image`, `video`) |
| `PUT` | `/api/photos/:date` | Update photo for date |
| `DELETE` | `/api/photos/:date` | Delete photo for date |

### Live Photo Upload

A Live Photo is uploaded as a **pair**:
- `image` — the still frame (JPEG, PNG, HEIC, WebP)
- `video` — the motion clip (MOV, MP4)

When both are present, the `is_live_photo` flag is set and the viewer shows a **▶ Play Live Photo** button in the lightbox.

---

## File Structure

```
apple-diary/
├── server/
│   ├── index.js          # Express server
│   ├── database.js       # SQLite setup
│   └── routes/
│       └── photos.js     # CRUD API routes
├── public/
│   ├── index.html        # Embeddable gallery
│   ├── admin.html        # Admin panel
│   ├── css/
│   │   ├── gallery.css   # Gallery styles
│   │   └── admin.css     # Admin styles
│   └── js/
│       ├── gallery.js    # Gallery logic (calendar + polaroid + lightbox)
│       └── admin.js      # Admin logic
├── uploads/              # Uploaded media (auto-created, git-ignored)
├── data/                 # SQLite DB (auto-created, git-ignored)
└── package.json
```
