import "dotenv/config";
import { PrismaClient } from "../prisma/generated/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function seedShiftTemplate(
  name: string,
  startTime: string,
  endTime: string,
) {
  const existing = await prisma.shiftTemplate.findFirst({
    where: { name },
  });

  if (existing) {
    console.log(`  ShiftTemplate ya existe: ${name}`);
    return existing;
  }

  const created = await prisma.shiftTemplate.create({
    data: { name, startTime, endTime },
  });

  console.log(`  ShiftTemplate creado: ${name}`);
  return created;
}

async function seedService(
  name: string,
  price: number,
  durationInMinutes: number,
) {
  const existing = await prisma.service.findFirst({
    where: { name },
  });

  if (existing) {
    console.log(`  Service ya existe: ${name}`);
    return existing;
  }

  const created = await prisma.service.create({
    data: { name, price, durationInMinutes },
  });

  console.log(`  Service creado: ${name}`);
  return created;
}

async function seedUser(
  phone: string,
  name: string,
  role: "ADMIN" | "MANICURISTA",
  username: string,
  password: string,
) {
  const user = await prisma.user.upsert({
    where: { phone },
    update: { name, role: { set: role }, username, password },
    create: { phone, name, role, username, password },
  });

  console.log(`  User upserted: ${name} - ${username} (${role})`);
  return user;
}

async function main() {
  console.log("🌿 Iniciando seed de WineSpa...\n");

  console.log("📋 ShiftTemplates:");
  await seedShiftTemplate("Turno Apertura", "08:00", "16:00");
  await seedShiftTemplate("Turno Cierre", "12:00", "20:00");

  console.log("\n💅 Services:");
  await seedService("Manicure Tradicional", 15.0, 45);
  await seedService("Manicure Semipermanente", 25.0, 60);
  await seedService("Pedicure Premium", 30.0, 75);
  await seedService("Uñas Esculpidas en Gel", 45.0, 120);

  console.log("\n👥 Users:");
  await seedUser("3001234567", "Admin WineSpa", "ADMIN", "admin", "admin123");
  await seedUser("3007654321", "Ana García", "MANICURISTA", "ana_garcia", "ana123");
  await seedUser("3019876543", "Carla López", "MANICURISTA", "carla_lopez", "carla123");

  console.log("\n✅ Seed completado exitosamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
