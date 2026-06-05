const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const db = require('../database');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${uuidv4()}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImage = /\.(jpg|jpeg|png|heic|heif|webp|gif)$/i;
  const allowedVideo = /\.(mov|mp4|m4v)$/i;
  if (allowedImage.test(file.originalname) || allowedVideo.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Images (JPG, PNG, HEIC, WebP) and videos (MOV, MP4) are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

// Helper: generate thumbnail from image
async function generateThumbnail(imagePath, thumbFilename) {
  const thumbPath = path.join(UPLOADS_DIR, thumbFilename);
  try {
    await sharp(imagePath)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toFile(thumbPath);
    return thumbFilename;
  } catch (err) {
    // If sharp can't process (e.g. HEIC without native support), return null
    console.warn('Thumbnail generation failed:', err.message);
    return null;
  }
}

// GET /api/photos — list all photos
router.get('/', (req, res) => {
  const { year, month } = req.query;
  let query = 'SELECT * FROM photos ORDER BY date DESC';
  let params = [];

  if (year && month) {
    const paddedMonth = String(month).padStart(2, '0');
    query = `SELECT * FROM photos WHERE date LIKE ? ORDER BY date ASC`;
    params = [`${year}-${paddedMonth}%`];
  } else if (year) {
    query = `SELECT * FROM photos WHERE date LIKE ? ORDER BY date ASC`;
    params = [`${year}%`];
  }

  const photos = db.prepare(query).all(...params);
  res.json(photos);
});

// GET /api/photos/:date — get single photo by date (YYYY-MM-DD)
router.get('/:date', (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE date = ?').get(req.params.date);
  if (!photo) return res.status(404).json({ error: 'No photo found for this date' });
  res.json(photo);
});

// POST /api/photos — create new photo entry
router.post('/', uploadFields, async (req, res) => {
  try {
    const { date, title, description } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required (YYYY-MM-DD)' });

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });

    const existing = db.prepare('SELECT id FROM photos WHERE date = ?').get(date);
    if (existing) return res.status(409).json({ error: 'A photo for this date already exists. Use PUT to update.' });

    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    if (!imageFile) return res.status(400).json({ error: 'An image file is required' });

    const id = uuidv4();
    let thumbnailFilename = null;
    const thumbName = `thumb-${id}.jpg`;
    thumbnailFilename = await generateThumbnail(imageFile.path, thumbName);

    db.prepare(`
      INSERT INTO photos (id, date, title, description, image_filename, video_filename, thumbnail_filename, is_live_photo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      date,
      title || null,
      description || null,
      imageFile.filename,
      videoFile?.filename || null,
      thumbnailFilename,
      videoFile ? 1 : 0
    );

    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
    res.status(201).json(photo);
  } catch (err) {
    console.error('POST /api/photos error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/photos/:date — update photo entry by date
router.put('/:date', uploadFields, async (req, res) => {
  try {
    const photo = db.prepare('SELECT * FROM photos WHERE date = ?').get(req.params.date);
    if (!photo) return res.status(404).json({ error: 'No photo found for this date' });

    const { title, description } = req.body;
    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    let imageFilename = photo.image_filename;
    let videoFilename = photo.video_filename;
    let thumbnailFilename = photo.thumbnail_filename;
    let isLivePhoto = photo.is_live_photo;

    if (imageFile) {
      // Remove old image and thumbnail
      const oldImagePath = path.join(UPLOADS_DIR, photo.image_filename);
      if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
      if (photo.thumbnail_filename) {
        const oldThumbPath = path.join(UPLOADS_DIR, photo.thumbnail_filename);
        if (fs.existsSync(oldThumbPath)) fs.unlinkSync(oldThumbPath);
      }
      imageFilename = imageFile.filename;
      const thumbName = `thumb-${photo.id}.jpg`;
      thumbnailFilename = await generateThumbnail(imageFile.path, thumbName);
    }

    if (videoFile) {
      if (photo.video_filename) {
        const oldVideoPath = path.join(UPLOADS_DIR, photo.video_filename);
        if (fs.existsSync(oldVideoPath)) fs.unlinkSync(oldVideoPath);
      }
      videoFilename = videoFile.filename;
      isLivePhoto = 1;
    }

    // Allow removing video (live photo deactivation)
    if (req.body.remove_video === 'true' && photo.video_filename) {
      const oldVideoPath = path.join(UPLOADS_DIR, photo.video_filename);
      if (fs.existsSync(oldVideoPath)) fs.unlinkSync(oldVideoPath);
      videoFilename = null;
      isLivePhoto = 0;
    }

    db.prepare(`
      UPDATE photos
      SET title = ?, description = ?, image_filename = ?, video_filename = ?,
          thumbnail_filename = ?, is_live_photo = ?, updated_at = datetime('now')
      WHERE date = ?
    `).run(
      title !== undefined ? title : photo.title,
      description !== undefined ? description : photo.description,
      imageFilename,
      videoFilename,
      thumbnailFilename,
      isLivePhoto,
      req.params.date
    );

    const updated = db.prepare('SELECT * FROM photos WHERE date = ?').get(req.params.date);
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/photos/:date error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/photos/:date — delete photo entry by date
router.delete('/:date', (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE date = ?').get(req.params.date);
  if (!photo) return res.status(404).json({ error: 'No photo found for this date' });

  // Delete files
  [photo.image_filename, photo.video_filename, photo.thumbnail_filename].forEach(f => {
    if (f) {
      const filePath = path.join(UPLOADS_DIR, f);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  db.prepare('DELETE FROM photos WHERE date = ?').run(req.params.date);
  res.json({ message: 'Photo deleted successfully' });
});

module.exports = router;
