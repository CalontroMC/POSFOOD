import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { adminRequired } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, "..", "..", "data", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id = crypto.randomBytes(8).toString("hex");
    const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname) || ".bin";
    cb(null, `${Date.now()}-${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new Error("ไฟล์ต้องเป็นรูปภาพ (jpg/png/webp/gif/svg) ไม่เกิน 5 MB"));
    }
    cb(null, true);
  },
});

const r = Router();

r.post("/image", adminRequired, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "ไม่มีไฟล์ที่อัปโหลด" });
  res.json({ url: `/uploads/${req.file.filename}`, size: req.file.size });
});

export default r;
