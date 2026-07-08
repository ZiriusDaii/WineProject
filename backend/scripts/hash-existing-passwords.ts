import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../prisma/generated/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const BCRYPT_HASH_PREFIX = /^\$2[aby]\$/;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Buscando usuarios con password en texto plano...\n");

  const users = await prisma.user.findMany({
    where: { password: { not: null } },
    select: { id: true, username: true, password: true },
  });

  const toHash = users.filter((u) => !BCRYPT_HASH_PREFIX.test(u.password!));

  if (toHash.length === 0) {
    console.log("Todos los passwords ya están hasheados. Nada que migrar.");
    return;
  }

  console.log(
    `Encontrados ${toHash.length} usuario(s) con password en texto plano:\n`,
  );

  for (const user of toHash) {
    const hashed = await bcrypt.hash(user.password!, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });
    console.log(`  ✓ ${user.username} (${user.id})`);
  }

  console.log(`\nMigración completada: ${toHash.length} usuario(s) actualizado(s).`);
}

main()
  .catch((e) => {
    console.error("Error durante la migración:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
