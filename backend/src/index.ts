import express, { type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma.js";
import apiRoutes from "./routes/api.routes.js";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL es obligatorio (ver backend/.env.example)");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT ?? 3000;

app.set("trust proxy", 1);

// crossOriginResourcePolicy en "cross-origin": el frontend corre en otro
// puerto/dominio y carga imagenes de /uploads via <img>, el default
// same-origin de helmet las bloquea.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// trim + filter: "https://a.com, https://b.com" (espacio tras la coma, tipeo
// comun) dejaba el segundo origen con un espacio inicial que nunca matchea
// nada; "" (CORS_ORIGIN vacio en vez de ausente) se convertia en [""], una
// lista "presente" que colaba el guard de produccion de abajo sin permitir
// ningun origen real.
const corsOrigins = process.env.CORS_ORIGIN
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!corsOrigins?.length && process.env.NODE_ENV === "production") {
  // Sin CORS_ORIGIN, `origin: true` refleja cualquier origen -- combinado con
  // que el login de cliente es solo por telefono (sin password/OTP), un sitio
  // hostil que sepa el numero de un cliente podria llamar /api/clients/auth
  // desde el navegador de cualquiera y leer su token + historial de citas.
  // Mejor no arrancar que arrancar mal configurado en produccion.
  throw new Error(
    "CORS_ORIGIN es obligatorio con NODE_ENV=production (ver backend/.env.example)",
  );
}
app.use(cors({ origin: corsOrigins?.length ? corsOrigins : true }));
app.use(express.json({ limit: "1mb" }));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, intente de nuevo mas tarde" },
  handler: (req, res, _next, options) => {
    console.warn(`Rate limit excedido: ip=${req.ip} ruta=${req.originalUrl}`);
    res.status(options.statusCode).json(options.message);
  },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos, intente de nuevo mas tarde" },
  handler: (req, res, _next, options) => {
    console.warn(`Rate limit excedido: ip=${req.ip} ruta=${req.originalUrl}`);
    res.status(options.statusCode).json(options.message);
  },
});
app.use("/api/auth", authLimiter);
// Solo registro y login de cliente, no todo /api/clients (ese prefijo tambien
// cubre GET /api/clients/:clientId/appointments, que un cliente real puede
// llamar mas de 10 veces por minuto en uso normal). Los dos POST si responden
// distinto segun si el telefono ya tiene cuenta (exists/409), asi que ambos
// son un oraculo para enumerar clientes a fuerza bruta.
app.post("/api/clients", authLimiter);
app.post("/api/clients/auth", authLimiter);

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
