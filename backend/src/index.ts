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

app.use(helmet());
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
app.use("/api/clients/auth", authLimiter);

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
