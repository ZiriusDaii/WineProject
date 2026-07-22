import express, { type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma.js";
import apiRoutes from "./routes/api.routes.js";
import whatsappRoutes from "./routes/whatsapp.routes.js";
import { startAppointmentReminderScheduler } from "./services/whatsapp-scheduler.js";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL es obligatorio (ver backend/.env.example)");
  process.exit(1);
}

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  // lib/jwt.ts cae a un secreto hardcodeado en el codigo fuente si falta esta
  // var -- en produccion eso equivale a firmar sesiones con una clave publica:
  // cualquiera podria forjar un JWT valido de ADMIN. Mejor no arrancar.
  console.error("JWT_SECRET es obligatorio con NODE_ENV=production (ver backend/.env.example)");
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
app.use(
  express.json({
    limit: "10mb",
    // El webhook de Meta firma el body crudo (X-Hub-Signature-256); una vez
    // que express.json lo parsea no hay forma de recuperar los bytes
    // originales para verificar esa firma, hay que guardarlos aca.
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 500, // 500 solicitudes por minuto
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.originalUrl.includes('/admin') || Boolean(req.headers.authorization?.startsWith('Bearer ')),
  message: { error: "Demasiadas solicitudes, intente de nuevo mas tarde" },
  handler: (req, res, _next, options) => {
    console.warn(`Rate limit excedido: ip=${req.ip} ruta=${req.originalUrl}`);
    res.status(options.statusCode).json(options.message);
  },
});
app.use(globalLimiter);

const staffAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos, intente de nuevo mas tarde" },
  handler: (req, res, _next, options) => {
    console.warn(`Rate limit excedido: ip=${req.ip} ruta=${req.originalUrl}`);
    res.status(options.statusCode).json(options.message);
  },
});
app.use("/api/auth", staffAuthLimiter);

// Limiter separado del de staff: comparten IP con clientes reservando desde
// la misma red (wifi del local, mismo NAT) -- si compartieran presupuesto,
// varios clientes reservando podian agotarlo y bloquear el login de un
// admin que no hizo nada mal. Mismo limite, cupo propio.
const clientAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos, intente de nuevo mas tarde" },
  handler: (req, res, _next, options) => {
    console.warn(`Rate limit excedido: ip=${req.ip} ruta=${req.originalUrl}`);
    res.status(options.statusCode).json(options.message);
  },
});
// Solo registro y login de cliente, no todo /api/clients (ese prefijo tambien
// cubre GET /api/clients/:clientId/appointments, que un cliente real puede
// llamar mas de 10 veces por minuto en uso normal). Los dos POST si responden
// distinto segun si el telefono ya tiene cuenta (exists/409), asi que ambos
// son un oraculo para enumerar clientes a fuerza bruta.
app.post("/api/clients", clientAuthLimiter);
app.post("/api/clients/auth", clientAuthLimiter);

app.use("/uploads", express.static(path.resolve("uploads"), { index: false }));

app.use("/api/whatsapp", whatsappRoutes);

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

startAppointmentReminderScheduler();
