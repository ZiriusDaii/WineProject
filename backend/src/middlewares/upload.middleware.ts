import type { Request, Response, NextFunction } from "express";
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

import fs from "node:fs";

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function validateUploadedFileMagicNumbers(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const file = req.file;
  if (!file) {
    next();
    return;
  }

  const filePath = file.path;
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    let isValid = false;
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      isValid = true;
    }
    // JPEG: FF D8 FF
    else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      isValid = true;
    }
    // WebP: RIFF ... WEBP (52 49 46 46 ... 57 45 42 50)
    else if (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      isValid = true;
    }

    if (!isValid) {
      fs.unlinkSync(filePath);
      res.status(400).json({ error: "El archivo subido no es una imagen válida (JPEG, PNG, WebP)" });
      return;
    }
    next();
  } catch (error) {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    res.status(500).json({ error: "Error de validacion del archivo subido" });
  }
}
