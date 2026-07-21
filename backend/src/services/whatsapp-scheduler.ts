import { prisma } from "../lib/prisma.js";
import { sendMessage } from "../services/whatsapp.service.js";

let lastRunDate: string | null = null;

function getColombiaDayStart(): Date {
  // Colombia is UTC-5. 9:00 AM Colombia = 14:00 UTC
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 14, 0, 0));
}

async function sendAppointmentReminders(): Promise<void> {
  const now = new Date();

  const colombiaDayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0),
  );
  const colombiaDayEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 23, 59, 59, 999),
  );

  console.log(`[Scheduler] Buscando citas para manana: ${colombiaDayStart.toISOString()} - ${colombiaDayEnd.toISOString()}`);

  try {
    const tomorrowAppointments = await prisma.appointment.findMany({
      where: {
        date: { gte: colombiaDayStart, lt: colombiaDayEnd },
        status: { not: "CANCELLED" },
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        manicurist: { select: { name: true } },
        services: { select: { name: true } },
      },
    });

    if (tomorrowAppointments.length === 0) {
      console.log("[Scheduler] No hay citas para manana");
      return;
    }

    console.log(`[Scheduler] Enviando ${tomorrowAppointments.length} recordatorios...`);

    for (const appointment of tomorrowAppointments) {
      const phone = appointment.client.phone;
      if (!phone) continue;

      const dateStr = appointment.date.toLocaleDateString("es-CO", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const timeStr = appointment.date.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const servicesStr = appointment.services.map((s) => s.name).join(", ");
      const totalPrice = Number(appointment.totalPrice).toLocaleString("es-CO");

      const message = [
        `🍷 *WineSpa - Recordatorio de Cita*`,
        ``,
        `¡Hola ${appointment.client.name}! Te recordamos que manana tienes una cita pendiente:`,
        ``,
        `📅 *Fecha:* ${dateStr}`,
        `🕐 *Hora:* ${timeStr}`,
        `💅 *Servicios:* ${servicesStr}`,
        `👩‍🎨 *Manicurista:* ${appointment.manicurist.name}`,
        `💰 *Total:* $${totalPrice}`,
        ``,
        `Si necesitas modificar o cancelar, ingresa a nuestro portal de clientes.`,
        `¡Te esperamos!`,
      ].join("\n");

      try {
        await sendMessage(phone, message);

        await prisma.whatsAppMessage.create({
          data: {
            waMessageId: `wamid.reminder.${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            from: "WineSpa",
            to: phone,
            body: `Recordatorio de cita: ${dateStr} ${timeStr} - ${servicesStr}`,
            direction: "OUTBOUND",
            status: "SENT",
            conversationId: `conv_${phone.replace(/\D/g, "")}`,
          },
        });

        console.log(`[Scheduler] Recordatorio enviado a ${appointment.client.name} (${phone})`);
      } catch (err) {
        console.error(`[Scheduler] Error enviando recordatorio a ${phone}:`, err);
      }
    }
  } catch (error) {
    console.error("[Scheduler] Error en sendAppointmentReminders:", error);
  }
}

export function startAppointmentReminderScheduler(): void {
  console.log("[Scheduler] Recordatorio de citas iniciado (cada 60s, dispara a las 9:00 AM Colombia)");

  setInterval(() => {
    const now = new Date();
    const colHour = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Bogota" }),
    ).getHours();
    const todayStr = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Bogota" }),
    ).toISOString().slice(0, 10);

    if (colHour === 9 && lastRunDate !== todayStr) {
      lastRunDate = todayStr;
      console.log(`[Scheduler] Ejecutando recordatorios - ${now.toISOString()}`);
      sendAppointmentReminders().catch((err) =>
        console.error("[Scheduler] Error enviando recordatorios:", err),
      );
    }

    // Reset at 10 AM to allow next day's run
    if (colHour >= 10 && lastRunDate) {
      lastRunDate = null;
    }
  }, 60_000);
}
