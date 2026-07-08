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

1. Levantar Postgres:

   ```bash
   docker compose up -d postgres
   ```

2. Backend:

   ```bash
   cd backend
   cp .env.example .env   # completá DATABASE_URL con el usuario/password de docker-compose.yml
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

## Variables de entorno (backend)

Ver `backend/.env.example`. Solo dos: `DATABASE_URL` y `PORT`. No hay secretos de sesión/JWT — el login de staff compara la contraseña directo (ver sección Seguridad).

## Estructura

```
backend/
  src/
    controllers/    # lógica de cada endpoint (client, admin, manicurist, auth, landing)
    routes/          # api.routes.ts es el único router que se importa de verdad (ver nota abajo)
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

**Nota:** `backend/src/routes/auth.routes.ts`, `client.routes.ts`, `admin.routes.ts` y `landing.routes.ts` existen pero no se importan en `index.ts` — todo el ruteo real vive en `api.routes.ts`. Son código muerto pendiente de limpieza.

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

## Seguridad — pendiente conocido

Las contraseñas de staff (`User.password`) se guardan **en texto plano**, sin hash. Es un hallazgo real, no corregido todavía (issue #9). No usar datos reales de usuarios en este ambiente hasta que se migre a bcrypt/argon2.

## Estado actual / qué falta

Ver [`NEXT_STEPS.md`](./NEXT_STEPS.md) para el detalle de qué está hecho, qué bug se encontró y no se corrigió, y el orden sugerido de los issues abiertos.
