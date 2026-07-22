FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# ponytail: prisma.config.ts exige DATABASE_URL para resolver el config aunque
# `generate` no abra conexion real; se le da un valor dummy solo para el build.
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/db" npx prisma generate && npm run build

# ponytail: single-stage, la imagen incluye devDependencies (prisma CLI, typescript).
# Pasar a build multi-stage si el tamaño de imagen llega a importar.
EXPOSE 3000
# Despues del build, no antes -- `npm ci`/`npm run build` con NODE_ENV=production
# ya seteado se saltearia las devDependencies (typescript, prisma CLI) que el
# build necesita. Esto es solo para el guard de CORS_ORIGIN en tiempo de
# ejecucion (src/index.ts): sin esto, un deploy real que se olvide de setear
# NODE_ENV=production por su cuenta se queda con CORS abierto por defecto.
ENV NODE_ENV=production
# Aplica migraciones pendientes antes de arrancar -- evita el paso manual de
# correr `prisma migrate deploy` aparte cada vez que se levanta un container
# nuevo. Es idempotente (prisma la sabe correr de nuevo sin duplicar nada).
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && node dist/src/index.js"]
