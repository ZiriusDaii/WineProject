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
# Aplica migraciones pendientes antes de arrancar -- evita el paso manual de
# correr `prisma migrate deploy` aparte cada vez que se levanta un container
# nuevo. Es idempotente (prisma la sabe correr de nuevo sin duplicar nada).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
