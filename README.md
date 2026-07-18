# WineSpa

Sistema de agendamiento para un spa de uñas: catálogo de servicios, reserva de citas, portal de clientes, agenda de manicuristas y panel de administración.

Monorepo con dos proyectos independientes (sin workspaces compartidos): `frontend/` (React + Vite) y `backend/` (Express + Prisma).

## Stack

| | |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS |
| Backend | Node 24, Express, TypeScript, Prisma 7 |
| Base de datos | PostgreSQL 15 |
| Auth | JWT (jsonwebtoken), bcrypt |
| Uploads | Multer (avatares, imágenes del carrusel, servicios) |
| CI/CD | GitHub Actions |

## Requisitos

- Node.js 24+
- Docker (para Postgres y backend)

## Cómo correrlo en local

### Rápido (Docker completo)

```bash
docker compose up -d
```

Esto levanta Postgres y el backend. No necesita archivos `.env` — todos los valores tienen defaults para desarrollo local. El backend queda en `http://localhost:3000`.

### Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### Solo Backend (sin Docker, para hot-reload)

Si preferís correr el backend con `npm run dev` para tener hot-reload:

```bash
cd backend
cp .env.example .env   # editalo con tus credenciales si no usas las default
npm install
npm run db:migrate:deploy   # aplica las migraciones (prisma migrate deploy)
npm run dev                 # http://localhost:3000
```

Ojo: si Docker ya está corriendo en el puerto 3000, paralo primero (`docker compose stop backend`).

## Estructura

```
backend/
  src/
    controllers/           # client, admin, manicurist, auth, landing
    middlewares/           # auth (JWT), upload (multer)
    lib/                   # prisma, jwt
    routes/api.routes.ts   # router unico con todos los endpoints
  prisma/
    schema.prisma
    seed.ts                # datos iniciales (servicios, manicuristas)
frontend/
  src/
    App.tsx                # landing, login, portal cliente, flujo reserva
    features/
      admin/views/         # panel de administracion
      manicurista/views/   # agenda de la manicurista
      legal/               # terminos, privacidad, cancelacion
```

## Variables de entorno

**No son necesarias para desarrollo.** `docker-compose.yml` tiene defaults para todo:

| Variable | Default | Uso |
|---|---|---|
| `POSTGRES_PASSWORD` | `winespa_local_2026` | Contraseña de Postgres |
| `DATABASE_URL` | `postgresql://postgres:winespa_local_2026@postgres:5432/winespa` | Conexión a BD |
| `JWT_SECRET` | `winespa-jwt-dev-secret` | Firma de tokens JWT |
| `CORS_ORIGIN` | `http://localhost:5173` | Orígenes permitidos para CORS |
| `PORT` | `3000` | Puerto del backend |

Para producción, creá un `.env` en la raíz con valores reales y pisará estos defaults.

## Seguridad

Implementado:
- **JWT**: login de staff y de cliente (por telefono, sin password/OTP -- ver "Pendiente") devuelven token. Endpoints admin/manicurista requieren `Authorization: Bearer <token>` via rol; las rutas de citas del cliente (`/appointments`, `/clients/:id/appointments`) exigen que el token pertenezca al dueño del recurso (401 sin token, 403 si es de otro cliente). Catálogo, ofertas y el chequeo de disponibilidad por fecha/manicurista siguen públicos, sin auth.
- **bcrypt**: contraseñas hasheadas con salt 10.
- **Helmet**: headers de seguridad (CSP, X-Frame-Options, HSTS, etc).
- **Rate limiting**: 200 req/min global, 10 req/min en `/api/auth` y en todo `/api/clients` (login y registro comparten limite -- ambos revelan si un telefono ya tiene cuenta).
- **CORS**: restrictivo por `CORS_ORIGIN`.
- **Uploads**: extensión forzada a `.jpg`, sin preservar la original (previene XSS).
- **Validación**: precios >= 0, duración > 0, descuentos 1-100, roles validados en runtime, fechas de citas no pueden quedar en el pasado.
- **Credenciales**: fuera del repo (`.env` en `.gitignore`), Docker Compose usa defaults para dev.
- **Migraciones**: `prisma migrate`, versionadas en `backend/prisma/migrations/`. Ver sección CI/CD.

Pendiente:
- El login de cliente es solo por telefono, sin password ni OTP -- cualquiera que sepa el numero de un cliente puede autenticarse como el (decision de alcance consciente, no un descuido). El token emitido evita que un tercero sin ese numero toque las citas de otro, pero no verifica identidad real.
- Sin índices de BD en `Appointment.date`, `manicuristId`, `status`, `User.role` — no crítico con el volumen actual.
- `DATABASE_URL` sin `sslmode=require` documentado para cuando la BD no este en la misma red privada que el backend (ver `backend/.env.example`).

## Scripts

**Backend** (`cd backend`)
| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor con hot-reload (`tsx watch`) |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Corre el build compilado |
| `npm run db:migrate -- <nombre>` | Crea y aplica una migracion nueva a partir de cambios en `schema.prisma` |
| `npm run db:migrate:deploy` | Aplica migraciones pendientes sin prompts (lo que corren CI y el Dockerfile) |
| `npm run db:studio` | Prisma Studio (UI para datos) |
| `npx tsx prisma/seed.ts` | Carga datos iniciales |

**Frontend** (`cd frontend`)
| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor Vite |
| `npm run build` | Typecheck + build |
| `npm run lint` | ESLint |

## CI/CD

- **CI** (`.github/workflows/ci.yml`): typecheck backend contra Postgres efímero + lint/typecheck frontend. Corre en cada PR a `develop`.
- **CD** (`.github/workflows/cd.yml`): build del frontend e imagen Docker del backend en cada push a `staging`. Sin deploy automático todavía.

## Flujo de trabajo (Git-Flow)

- `main` / `staging` / `develop` son ramas permanentes.
- Todo el trabajo sale de `develop` en `feature/*` o `bugfix/*`, con PR de vuelta a `develop`.
- Un PR por issue. No se mezclan issues distintos en la misma rama.
