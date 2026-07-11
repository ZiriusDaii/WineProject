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
npx prisma db push
npm run dev            # http://localhost:3000
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
    seed.ts                # datos iniciales (servicios, sedes, manicuristas)
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
- **JWT**: login de staff devuelve token. Endpoints admin y manicurista requieren `Authorization: Bearer <token>`. Rutas públicas (catálogo, booking) sin cambios.
- **bcrypt**: contraseñas hasheadas con salt 10.
- **Helmet**: headers de seguridad (CSP, X-Frame-Options, HSTS, etc).
- **Rate limiting**: 200 req/min global, 10 req/min en login y auth de clientes.
- **CORS**: restrictivo por `CORS_ORIGIN`.
- **Uploads**: extensión forzada a `.jpg`, sin preservar la original (previene XSS).
- **Validación**: precios >= 0, duración > 0, descuentos 1-100, roles validados en runtime.
- **Credenciales**: fuera del repo (`.env` en `.gitignore`), Docker Compose usa defaults para dev.

Pendiente:
- `http://localhost:3000` hardcodeado en ~25 `fetch` del frontend — no rompe en dev, pero hay que mover a variable de entorno antes de producción.
- Sin índices de BD en `Appointment.date`, `manicuristId`, `status`, `User.role` — no crítico con el volumen actual.

## Scripts

**Backend** (`cd backend`)
| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor con hot-reload (`tsx watch`) |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Corre el build compilado |
| `npm run db:push` | Aplica `schema.prisma` a la BD |
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
