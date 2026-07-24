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
  gender: "MUJER" | "HOMBRE" | "NINOS" | "UNISEX" = "UNISEX",
) {
  // name+category, no solo name: coincide con el chequeo de duplicados de
  // createService (admin.controller.ts). Sin esto, un servicio real de
  // hombres con el mismo nombre que un placeholder viejo en otra categoria
  // (ej. "Manicure Tradicional") se saltearia como "ya existe" y nunca se
  // crearia.
  const existing = await prisma.service.findFirst({
    where: { name, category },
  });

  if (existing) {
    console.log(`  Service ya existe: ${name} (${category})`);
    return existing;
  }

  const created = await prisma.service.create({
    data: { name, price, durationInMinutes, shortDescription, includesDescription, category, gender },
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

  // Los 4 placeholders originales (Manicure/Pedicure/Uñas Esculpidas
  // genericos, sin datos reales) se retiraron de aca -- la carta real de
  // abajo los reemplaza. Las filas viejas siguen en bases ya sembradas
  // (dev/prod); no se borran solas, quedan para que el negocio decida.

  // Carta real (foto de precios del local, cargada 2026-07-24). Nombres y
  // precios son los reales; las duraciones NO estan en la carta -- son
  // estimados razonables por tipo de servicio, a ajustar por el negocio
  // via el panel admin. La fila "niños hasta 9 años" a $33 (vs. la de $23
  // aca abajo) se omite a proposito: la carta tiene dos lineas identicas
  // ("Tradicionales") con precio distinto y sin aclarar la diferencia --
  // pendiente de confirmar con el negocio antes de cargarla.
  console.log("\n💅 Services (carta real):");

  const secadoRapidoNote = "Con secado rápido: +$2.000 adicionales.";

  // Precios Hombres -- sin category: el genero ya los identifica, ponerles
  // category "Hombres" duplicaba el pill de genero adentro del select de
  // categoria del booking.
  await seedService("Manicure Tradicional", 26000, 45, secadoRapidoNote, "Manicure tradicional para hombre.", null, "HOMBRE");
  await seedService("Pedicure Tradicional", 28000, 60, secadoRapidoNote, "Pedicure tradicional para hombre.", null, "HOMBRE");
  await seedService("Manicure Semipermanente", 35000, 60, secadoRapidoNote, "Manicure semipermanente para hombre.", null, "HOMBRE");
  await seedService("Pedicure Semipermanente", 35000, 75, secadoRapidoNote, "Pedicure semipermanente para hombre.", null, "HOMBRE");

  // Precios Mujeres -- mismo motivo, sin category.
  await seedService("Manos Semi", 60000, 75, secadoRapidoNote, "Semipermanente en manos.", null, "MUJER");
  await seedService("Pies Semi", 45000, 75, secadoRapidoNote, "Semipermanente en pies.", null, "MUJER");
  await seedService("Manos Tradicionales", 30000, 45, secadoRapidoNote, "Manicure tradicional en manos.", null, "MUJER");
  await seedService("Pies Tradicionales", 30000, 60, secadoRapidoNote, "Pedicure tradicional en pies.", null, "MUJER");

  // Extensiones y retiros -- MUJER, no UNISEX: "Precios Hombres" en la carta
  // lista exactamente los 4 servicios de arriba y nada mas, asi que nada de
  // esto se ofrece para hombres (confirmado por el negocio). Niños tiene su
  // propio genero (NINOS) para que el admin lo organice aparte, tambien sin
  // category redundante.
  await seedService("Manos o Pies Tradicionales (niños hasta 9 años)", 23000, 30, "Cada uno (manos o pies por separado).", "Manicure o pedicure tradicional para niños hasta 9 años.", null, "NINOS");

  await seedService("Dipping/Dippower 1 Capa", 70000, 60, "", "Aplicación de dipping/dippower, una capa.", "Extensiones", "MUJER");
  await seedService("Dipping/Dippower 2 Capas", 80000, 75, "", "Aplicación de dipping/dippower, dos capas.", "Extensiones", "MUJER");
  await seedService("Forrado en Perla", 90000, 90, "", "Forrado decorativo en perla.", "Extensiones", "MUJER");
  await seedService("Base Rubber 1 Capa", 70000, 60, "", "Base rubber, una capa.", "Extensiones", "MUJER");
  await seedService("Base Rubber 2 Capas", 80000, 75, "", "Base rubber, dos capas.", "Extensiones", "MUJER");
  await seedService("Forrado en Polygel", 90000, 90, "", "Forrado decorativo en polygel.", "Extensiones", "MUJER");
  await seedService("Press On", 120000, 90, "", "Aplicación de uñas press on.", "Extensiones", "MUJER");
  await seedService("Retoque Press On", 80000, 45, "", "Retoque de uñas press on.", "Extensiones", "MUJER");
  await seedService("Esculpidas en Poly Gel", 125000, 120, "", "Uñas esculpidas en poly gel.", "Extensiones", "MUJER");
  await seedService("Acrílicas Hasta #3", 125000, 120, "", "Uñas acrílicas hasta tamaño #3.", "Extensiones", "MUJER");
  await seedService("Retoque de Acrílicas", 85000, 60, "", "Retoque de acrílicas hechas en WineSpa.", "Extensiones", "MUJER");
  await seedService("Retoque de Acrílicas de Otro Lugar", 90000, 60, "", "Retoque de acrílicas hechas en otro salón.", "Extensiones", "MUJER");
  await seedService("Uña Adicional", 15000, 15, "", "Reposición de una uña adicional.", "Extensiones", "MUJER");

  // Retiros
  await seedService("Retiro de Semi de Otro Lugar (1 Servicio)", 10000, 20, "", "Retiro de esmaltado semipermanente hecho en otro salón, manos o pies.", "Retiros", "MUJER");
  await seedService("Retiro de Semi de Otro Lugar (Manos y Pies)", 15000, 30, "", "Retiro de esmaltado semipermanente hecho en otro salón, manos y pies.", "Retiros", "MUJER");

  console.log("\n👥 Users:");
  await seedUser("3001234567", "Admin WineSpa", "ADMIN", "admin", "admin123");
  await seedUser("3007654321", "Ana García", "MANICURISTA", "ana_garcia", "ana123");
  await seedUser("3019876543", "Carla López", "MANICURISTA", "carla_lopez", "carla123");

  console.log("\n👥 Manicuristas de testing:");
  await seedUser("3001110001", "Valentina Ruiz", "MANICURISTA", "valentina_ruiz", "test123");
  await seedUser("3001110002", "Daniela Mora", "MANICURISTA", "daniela_mora", "test123");
  await seedUser("3001110003", "Mariana Ochoa", "MANICURISTA", "mariana_ochoa", "test123");
  await seedUser("3001110004", "Camila Herrera", "MANICURISTA", "camila_herrera", "test123");
  await seedUser("3001110005", "Laura Jiménez", "MANICURISTA", "laura_jimenez", "test123");
  await seedUser("3001110006", "Sofía Restrepo", "MANICURISTA", "sofia_restrepo", "test123");

  console.log("\n📱 WhatsApp Templates:");
  const welcomeTemplate = await prisma.whatsAppTemplate.upsert({
    where: { name: "welcome" },
    update: {
      headerText: "WineSpa",
      bodyText: "¡Bienvenida a WineSpa! Tu espacio premium para el cuidado de uñas. ¿Como podemos ayudarte hoy?",
      button1Id: "agendar_cita",
      button1Title: "Agendar Cita",
      button2Id: "modificar_cita",
      button2Title: "Modificar Cita",
      button3Id: "solicitar_asesor",
      button3Title: "Solicitar Asesor",
      isActive: true,
    },
    create: {
      name: "welcome",
      headerText: "WineSpa",
      bodyText: "¡Bienvenida a WineSpa! Tu espacio premium para el cuidado de uñas. ¿Como podemos ayudarte hoy?",
      button1Id: "agendar_cita",
      button1Title: "Agendar Cita",
      button2Id: "modificar_cita",
      button2Title: "Modificar Cita",
      button3Id: "solicitar_asesor",
      button3Title: "Solicitar Asesor",
      isActive: true,
    },
  });
  console.log(`  WhatsAppTemplate creado: ${welcomeTemplate.name}`);

  console.log("\n✅ Seed completado exitosamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
