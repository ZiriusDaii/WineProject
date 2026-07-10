import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.resolve("uploads"));
  },
  filename(_req, _file, cb) {
    const uniqueName = `${Date.now()}-${randomUUID()}.jpg`;
    cb(null, uniqueName);
  },
});

const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten imágenes JPEG, PNG o WebP"));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
