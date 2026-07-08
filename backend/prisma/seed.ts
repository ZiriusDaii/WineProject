import "dotenv/config";
import bcrypt from "bcryptjs";
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
  shortDescription: string,
  includesDescription: string,
  category: string | null,
) {
  const existing = await prisma.service.findFirst({
    where: { name },
  });

  if (existing) {
    console.log(`  Service ya existe: ${name}`);
    return existing;
  }

  const created = await prisma.service.create({
    data: { name, price, durationInMinutes, shortDescription, includesDescription, category },
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
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { phone },
    update: { name, role: { set: role }, username, password: hashedPassword },
    create: { phone, name, role, username, password: hashedPassword },
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
  await seedService("Manicure Tradicional", 15.0, 45, "Cuidado clásico para lucir uñas impecables con un acabado natural y elegante.", "Incluye limado y forma de uñas, remoción y tratamiento de cutículas, exfoliación suave de manos, esmaltado clásico con el color de preferencia e hidratación final.", "MANICURE");
  await seedService("Manicure Semipermanente", 25.0, 60, "Esmalte de larga duración que mantiene tus uñas perfectas por semanas.", "Incluye preparación de la uña natural, base coat, capas de esmalte semipermanente en el color elegido, sellado con top coat, secado con lámpara UV/LED y retiro del esmalte anterior.", "MANICURE");
  await seedService("Pedicure Premium", 30.0, 75, "Experiencia completa de cuidado y relajación para tus pies.", "Incluye remojo en agua tibia aromatizada, limado y forma de uñas, tratamiento de cutículas, exfoliación de pies, masaje relajante con crema hidratante y esmaltado profesional.", "PEDICURE");
  await seedService("Uñas Esculpidas en Gel", 45.0, 120, "Extensiones de uñas personalizadas con gel UV para un look sofisticado.", "Incluye preparación completa de la uña, aplicación de tips o molde, construcción con gel UV, limado y perfilado profesional, diseño personalizado a elección y sellado con top coat de brillo.", "NAIL_ART");

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
