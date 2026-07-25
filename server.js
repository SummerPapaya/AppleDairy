import express from "express";
import multer from "multer";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

for (const dir of [UPLOAD_DIR, DATA_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ photos: [] }, null, 2));
}

// ---------------------------------------------------------------------------
// Tiny JSON "database" with a write queue so concurrent writes stay consistent.
// ---------------------------------------------------------------------------
let writeChain = Promise.resolve();

async function readDB() {
  const raw = await fsp.readFile(DB_FILE, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return { photos: [] };
  }
}

function writeDB(mutator) {
  writeChain = writeChain.then(async () => {
    const db = await readDB();
    const result = await mutator(db);
    await fsp.writeFile(DB_FILE, JSON.stringify(db, null, 2));
    return result;
  });
  return writeChain;
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const VIDEO_TYPES = ["video/quicktime", "video/mp4", "video/webm", "video/x-m4v"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || "";
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "image" && IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    if (file.fieldname === "video" && VIDEO_TYPES.includes(file.mimetype)) return cb(null, true);
    // Be permissive about mobile mime quirks: accept by extension as a fallback.
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === "image" && [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"].includes(ext)) {
      return cb(null, true);
    }
    if (file.fieldname === "video" && [".mov", ".mp4", ".webm", ".m4v"].includes(ext)) {
      return cb(null, true);
    }
    cb(new Error(`Unsupported ${file.fieldname} type: ${file.mimetype}`));
  },
});

const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 },
]);

/**
 * Transcode an arbitrary video into a web-friendly, looping-ready MP4 (H.264/AAC,
 * faststart). This makes iPhone .mov "Live Photo" clips play reliably in browsers.
 * Falls back to the original file if ffmpeg is unavailable or fails.
 */
function transcodeToMp4(srcPath) {
  return new Promise((resolve) => {
    const outPath = srcPath.replace(/\.[^.]+$/, "") + "-web.mp4";
    const args = [
      "-y",
      "-i", srcPath,
      "-vf", "scale='min(1280,iw)':-2",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-preset", "veryfast",
      "-crf", "24",
      "-movflags", "+faststart",
      "-c:a", "aac",
      "-b:a", "128k",
      outPath,
    ];
    const ff = spawn("ffmpeg", args, { stdio: "ignore" });
    ff.on("error", () => resolve(null));
    ff.on("close", (code) => {
      if (code === 0 && fs.existsSync(outPath)) {
        // Remove the original to save space, keep the web mp4.
        fs.unlink(srcPath, () => {});
        resolve(outPath);
      } else {
        resolve(null);
      }
    });
  });
}

function publicUrl(absPath) {
  if (!absPath) return null;
  return "/uploads/" + path.basename(absPath);
}

const DEFAULT_THUMB_CROP = { x: 50, y: 50, zoom: 1 };

function parseThumbCrop(raw) {
  if (!raw) return { ...DEFAULT_THUMB_CROP };
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_THUMB_CROP };
    }
  }
  if (!obj || typeof obj !== "object") return { ...DEFAULT_THUMB_CROP };
  const clamp = (n, lo, hi, fallback) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  };
  return {
    x: clamp(obj.x, 0, 100, DEFAULT_THUMB_CROP.x),
    y: clamp(obj.y, 0, 100, DEFAULT_THUMB_CROP.y),
    zoom: clamp(obj.zoom, 1, 3, DEFAULT_THUMB_CROP.zoom),
  };
}

function parseAspectRatio(raw) {
  const v = Number(raw);
  return Number.isFinite(v) && v > 0.05 && v < 20 ? v : null;
}

function uploadAbsPath(url) {
  if (!url) return null;
  return path.join(UPLOAD_DIR, path.basename(url));
}

async function removeUpload(url) {
  const abs = uploadAbsPath(url);
  if (abs && fs.existsSync(abs)) {
    await fsp.unlink(abs).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Admin auth (session cookie). Set ADMIN_PASSWORD to enable.
// ---------------------------------------------------------------------------
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const AUTH_ENABLED = ADMIN_PASSWORD.length > 0;
const SESSION_COOKIE = "apple_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const sessions = new Map(); // token -> expiresAt (ms)

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((part) => {
      const i = part.indexOf("=");
      if (i === -1) return [part.trim(), ""];
      return [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
    })
  );
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function validateSession(token) {
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp || Date.now() > exp) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure}`;
}

function getSessionToken(req) {
  return parseCookies(req)[SESSION_COOKIE];
}

function requireAuth(req, res, next) {
  if (!AUTH_ENABLED) return next();
  if (validateSession(getSessionToken(req))) return next();
  res.status(401).json({ error: "Authentication required" });
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());

// Allow the viewer + API to be embedded cross-origin on the owner's website.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

// ---- Auth ----
app.get("/api/auth/status", (req, res) => {
  if (!AUTH_ENABLED) {
    return res.json({ authRequired: false, authenticated: true });
  }
  res.json({
    authRequired: true,
    authenticated: validateSession(getSessionToken(req)),
  });
});

app.post("/api/auth/login", (req, res) => {
  if (!AUTH_ENABLED) return res.json({ ok: true });
  const username = (req.body?.username || "").trim();
  const password = req.body?.password || "";
  if (safeEqual(username, ADMIN_USER) && safeEqual(password, ADMIN_PASSWORD)) {
    const token = createSession();
    res.setHeader("Set-Cookie", sessionCookie(token));
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Invalid username or password" });
});

app.post("/api/auth/logout", (req, res) => {
  const token = getSessionToken(req);
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.json({ ok: true });
});

// ---- API ----
app.get("/api/photos", async (_req, res) => {
  const db = await readDB();
  const photos = [...db.photos].sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json(photos);
});

app.get("/api/photos/:id", async (req, res) => {
  const db = await readDB();
  const photo = db.photos.find((p) => p.id === req.params.id);
  if (!photo) return res.status(404).json({ error: "Not found" });
  res.json(photo);
});

app.post("/api/photos", requireAuth, uploadFields, async (req, res) => {
  try {
    const date = (req.body.date || "").trim();
    const description = (req.body.description || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "A valid date (YYYY-MM-DD) is required." });
    }
    const imageFile = req.files?.image?.[0];
    if (!imageFile) return res.status(400).json({ error: "An image is required." });

    let videoUrl = null;
    const videoFile = req.files?.video?.[0];
    if (videoFile) {
      const transcoded = await transcodeToMp4(videoFile.path);
      videoUrl = publicUrl(transcoded || videoFile.path);
    }

    const photo = {
      id: crypto.randomUUID(),
      date,
      description,
      imageUrl: publicUrl(imageFile.path),
      videoUrl,
      thumbCrop: parseThumbCrop(req.body.thumbCrop),
      aspectRatio: parseAspectRatio(req.body.aspectRatio),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeDB((db) => {
      db.photos.push(photo);
    });
    res.status(201).json(photo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/photos/:id", requireAuth, uploadFields, async (req, res) => {
  try {
    const id = req.params.id;
    const db = await readDB();
    const existing = db.photos.find((p) => p.id === id);
    if (!existing) return res.status(404).json({ error: "Not found" });

    const updates = {};
    if (typeof req.body.date === "string" && req.body.date.trim()) {
      const date = req.body.date.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Invalid date format." });
      }
      updates.date = date;
    }
    if (typeof req.body.description === "string") {
      updates.description = req.body.description.trim();
    }
    if (req.body.thumbCrop != null) {
      updates.thumbCrop = parseThumbCrop(req.body.thumbCrop);
    }
    if (req.body.aspectRatio != null) {
      const ar = parseAspectRatio(req.body.aspectRatio);
      if (ar) updates.aspectRatio = ar;
    }

    const imageFile = req.files?.image?.[0];
    if (imageFile) {
      await removeUpload(existing.imageUrl);
      updates.imageUrl = publicUrl(imageFile.path);
      if (req.body.thumbCrop == null) updates.thumbCrop = { ...DEFAULT_THUMB_CROP };
      if (req.body.aspectRatio == null) updates.aspectRatio = null;
    }

    const videoFile = req.files?.video?.[0];
    if (videoFile) {
      await removeUpload(existing.videoUrl);
      const transcoded = await transcodeToMp4(videoFile.path);
      updates.videoUrl = publicUrl(transcoded || videoFile.path);
    } else if (req.body.removeVideo === "true") {
      await removeUpload(existing.videoUrl);
      updates.videoUrl = null;
    }

    updates.updatedAt = new Date().toISOString();

    const saved = await writeDB((db2) => {
      const target = db2.photos.find((p) => p.id === id);
      Object.assign(target, updates);
      return target;
    });
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/photos/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  const db = await readDB();
  const existing = db.photos.find((p) => p.id === id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  await removeUpload(existing.imageUrl);
  await removeUpload(existing.videoUrl);
  await writeDB((db2) => {
    db2.photos = db2.photos.filter((p) => p.id !== id);
  });
  res.json({ ok: true });
});

// ---- Static pages ----
app.use(express.static(PUBLIC_DIR));

app.get("/admin", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "admin.html")));
app.get("/embed", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "embed-demo.html")));
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Multer / generic error handler
app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || "Upload error" });
});

app.listen(PORT, () => {
  console.log(`🍎 An Apple A Day running at http://localhost:${PORT}`);
  console.log(`   Viewer:  http://localhost:${PORT}/`);
  console.log(`   Admin:   http://localhost:${PORT}/admin`);
  if (AUTH_ENABLED) {
    console.log(`   Auth:    enabled (user: ${ADMIN_USER})`);
  } else {
    console.warn("   Auth:    DISABLED — set ADMIN_PASSWORD to protect admin writes");
  }
});
