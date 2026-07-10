# WineSpa

Sistema de agendamiento para un spa de uñas: catálogo de servicios, reserva de citas, portal de clientes, agenda de manicuristas y panel de administración.

Monorepo con dos proyectos independientes (sin workspaces compartidos): `frontend/` (React + Vite) y `backend/` (Express + Prisma).

## Stack

| | |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS |
| Backend | Node 24, Express, TypeScript, Prisma 7 |
| Base de datos | PostgreSQL 15 |
| Uploads | Multer (avatares, imágenes del carrusel) |
| CI/CD | GitHub Actions |

## Requisitos

- Node.js 24+
- Docker (para Postgres; opcional si ya tenés un Postgres local)

## Cómo correrlo en local

1. Levantar Postgres (`docker-compose.yml` lee las credenciales de un `.env` en la raíz, no las trae hardcodeadas):

   ```bash
   cp .env.example .env   # elegí una password
   docker compose up -d postgres
   ```

2. Backend:

   ```bash
   cd backend
   cp .env.example .env   # DATABASE_URL debe usar la misma password que pusiste en el .env de la raíz
   npm install
   npm run db:push        # aplica el schema de Prisma a la base
   npm run dev             # http://localhost:3000
   ```

3. Frontend, en otra terminal:

   ```bash
   cd frontend
   npm install
   npm run dev             # http://localhost:5173
   ```

El frontend llama al backend directo en `http://localhost:3000` (sin proxy ni variable de entorno de por medio — está hardcodeado en los `fetch`).

### Con Docker Compose completo

`docker compose up -d` levanta Postgres **y** el backend en un contenedor (`Dockerfile` en `backend/`). El frontend no está dockerizado, se corre aparte con `npm run dev`. Ojo: el contenedor del backend tiene `restart: always`, así que si lo usaste antes puede seguir vivo y competir por el puerto 3000 con tu `npm run dev` local — pará el contenedor (`docker compose stop backend`) antes de correr el backend en local con hot-reload.

## Variables de entorno

- Raíz (`.env.example`): credenciales de Postgres que usa `docker-compose.yml` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `PORT`).
- `backend/.env.example`: `DATABASE_URL` y `PORT` para correr el backend con `npm run dev` fuera de Docker.
- `CORS_ORIGIN` (opcional, backend): lista de orígenes permitidos separados por coma. Sin definir, acepta cualquier origen (default de dev).

No hay secretos de sesión/JWT — el login de staff compara la contraseña contra un hash bcrypt (ver sección Seguridad).

## Estructura

```
backend/
  src/
    controllers/    # lógica de cada endpoint (client, admin, manicurist, auth, landing)
    routes/api.routes.ts  # unico router, registra todos los endpoints
    middlewares/     # multer (upload de imágenes)
    lib/prisma.ts    # cliente de Prisma
  prisma/schema.prisma
frontend/
  src/
    App.tsx                          # landing, login, portal de cliente, flujo de reserva
    features/admin/views/            # panel de administración
    features/manicurista/views/      # agenda de la manicurista
    features/legal/                  # términos, privacidad, cancelación
```

**Nota:** `features/cliente/views/ClientDashboard.tsx` y `features/owner/views/BusinessOverview.tsx` existen pero no se importan en ningún lado (el portal del cliente real vive dentro de `App.tsx`). Código muerto, pendiente de limpieza.

## Scripts

**Backend** (`cd backend`)
| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor con hot-reload (`tsx watch`) |
| `npm run build` | Compila a `dist/` |
| `npm start` | Corre el build compilado |
| `npm run db:push` | Aplica `schema.prisma` a la base sin migración formal |
| `npm run db:studio` | Prisma Studio (UI para ver/editar datos) |

**Frontend** (`cd frontend`)
| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` | Typecheck + build de producción |
| `npm run lint` | ESLint |

## CI/CD

- **CI** (`.github/workflows/ci.yml`): corre en cada PR contra `develop`. Typecheck de backend contra un Postgres efímero + `prisma db push`, y lint + typecheck de frontend.
- **CD** (`.github/workflows/cd.yml`): en cada push a `staging`, build del frontend y de la imagen Docker del backend, solo para certificar que empaquetan bien. Todavía no hay deploy automático a ningún entorno — se agrega cuando exista el servidor destino.

## Flujo de trabajo (Git-Flow)

- `main` / `staging` / `develop` son ramas permanentes. `main` recibe merges solo desde `staging`.
- Todo el trabajo nuevo sale de `develop` en una rama `feature/*` o `bugfix/*`, con su propio PR de vuelta a `develop`. Un PR por issue o arreglo — no se mezclan cambios de distintos issues en la misma rama.

## Seguridad

Hecho: passwords de staff hasheadas con bcrypt, `helmet()`, rate limiting (global y reforzado en `/api/auth` y `/api/clients/auth`), CORS restrictivo vía `CORS_ORIGIN`, límite de tamaño de body, credenciales de Docker fuera del repo, y varios bugs de validación/autorización corregidos (ver historial de PRs de auditoría de seguridad).

Pendiente conocido, no resuelto todavía:
- **Sin autenticación por sesión/JWT** en los endpoints de admin y manicurista — hoy cualquiera que sepa la URL puede llamarlos directo, el login solo protege la UI. Es el hueco más grande que queda.
- `http://localhost:3000` está hardcodeado en decenas de `fetch` del frontend en vez de una variable de entorno compartida — no rompe nada en dev, pero hay que resolverlo antes de desplegar a un dominio real.
- Sin índices de base de datos en columnas que se filtran seguido (`Appointment.date`, `manicuristId`, `status`, `User.role`) — no es un problema con el volumen de datos actual, pero conviene agregarlos antes de producción.

No usar datos reales de clientes en este ambiente hasta que se resuelva la autenticación por sesión.

## Estado actual / qué falta

Ver los [issues abiertos del repo](https://github.com/ZiriusDaii/WineProject/issues) para lo pendiente.
