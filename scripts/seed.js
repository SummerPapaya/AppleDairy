/**
 * Seed demo apple photos for local development / preview.
 * Run: node scripts/seed.js
 */
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const SAMPLES = [
  { date: "2026-06-01", description: "Morning market Fuji — crisp & sweet", color: "#e8604c" },
  { date: "2026-06-02", description: "A tiny green Granny on the windowsill", color: "#87b067" },
  { date: "2026-06-03", description: "Honeycrisp afternoon snack", color: "#f6c453" },
  { date: "2026-06-04", description: "Rainy-day apple tea companion", color: "#c8472f" },
  { date: "2026-06-05", description: "Today's apple — a perfect little sphere", color: "#e8604c" },
];

async function makePng(outPath, color, label) {
  const py = `
from PIL import Image, ImageDraw, ImageFont
import sys
w, h = 640, 640
img = Image.new("RGB", (w, h), "#fffdf6")
draw = ImageDraw.Draw(img)
cx, cy = w // 2, h // 2 + 20
r = 200
draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill="${color}", outline="#4a423b", width=6)
draw.ellipse([cx-r+40, cy-r+30, cx-r+120, cy-r+50], fill=(255,255,255,80))
draw.rectangle([cx-8, cy-r-50, cx+8, cy-r-10], fill="#8a5a3c")
leaf = [(cx+30, cy-r-35), (cx+90, cy-r-55), (cx+70, cy-r-5), (cx+20, cy-r-15)]
draw.polygon(leaf, fill="#87b067", outline="#5f8a45")
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
except Exception:
    font = ImageFont.load_default()
draw.text((w//2, h-80), "${label.replace(/"/g, '\\"')}", fill="#4a423b", anchor="mm", font=font)
img.save(sys.argv[1])
`;
  const tmp = path.join(ROOT, ".seed-tmp.py");
  await fsp.writeFile(tmp, py);
  const r = spawnSync("python3", [tmp, outPath]);
  await fsp.unlink(tmp).catch(() => {});
  if (r.status !== 0) throw new Error("Failed to generate PNG");
}

function makeMp4(outPath, color) {
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f", "lavfi",
      "-i", "color=c=white:s=640x640:d=2",
      "-vf",
      `drawbox=x=220:y=220:w=200:h=200:color=${color}:t=fill,format=yuv420p`,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath,
    ],
    { stdio: "ignore" }
  );
  return r.status === 0;
}

async function main() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const photos = [];
  for (const s of SAMPLES) {
    const id = crypto.randomUUID();
    const imgName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.png`;
    const imgPath = path.join(UPLOAD_DIR, imgName);
    await makePng(imgPath, s.color, s.date);

    let videoUrl = null;
    const vidName = imgName.replace(".png", "-web.mp4");
    const vidPath = path.join(UPLOAD_DIR, vidName);
    if (makeMp4(vidPath, s.color.replace("#", "0x"))) {
      videoUrl = `/uploads/${vidName}`;
    }

    photos.push({
      id,
      date: s.date,
      description: s.description,
      imageUrl: `/uploads/${imgName}`,
      videoUrl,
      thumbCrop: { x: 50, y: 50, zoom: 1 },
      aspectRatio: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await new Promise((r) => setTimeout(r, 5));
  }

  await fsp.writeFile(DB_FILE, JSON.stringify({ photos }, null, 2));
  console.log(`Seeded ${photos.length} demo apples → ${DB_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
