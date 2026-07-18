import express, { type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma.js";
import apiRoutes from "./routes/api.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

app.set("trust proxy", 1);

// crossOriginResourcePolicy en "cross-origin": el frontend corre en otro
// puerto/dominio y carga imagenes de /uploads via <img>, el default
// same-origin de helmet las bloquea.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));
app.use(express.json({ limit: "1mb" }));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, intente de nuevo mas tarde" },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos, intente de nuevo mas tarde" },
});
app.use("/api/auth", authLimiter);
// Cubre /api/clients (registro) y /api/clients/auth (login) por igual: ambas
// responden distinto segun si un telefono ya tiene cuenta (exists/409), asi
// que las dos son un oraculo para enumerar clientes por telefono a fuerza bruta.
app.use("/api/clients", authLimiter);

app.use("/uploads", express.static(path.resolve("uploads"), { index: false }));

app.use("/api", apiRoutes);

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "WineSpa API corriendo correctamente" });
});

app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (error) {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor WineSpa corriendo en http://localhost:${PORT}`);
});
