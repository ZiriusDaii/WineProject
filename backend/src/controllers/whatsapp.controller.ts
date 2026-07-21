import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { sendButtonMessage, sendInteractiveMessage, sendMessage } from "../services/whatsapp.service.js";

export async function verifyWebhook(req: Request, res: Response): Promise<void> {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log(`[WhatsApp Webhook] Verificacion recibida: mode=${mode}, token=${token}`);

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (!verifyToken) {
      console.error("[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN no esta configurado");
      res.status(500).json({ error: "Webhook no configurado en el servidor" });
      return;
    }

    if (mode === "subscribe" && token === verifyToken) {
      console.log("[WhatsApp Webhook] Verificacion exitosa");
      res.status(200).send(String(challenge));
      return;
    }

    console.warn("[WhatsApp Webhook] Verificacion fallida: token no coincide o mode incorrecto");
    res.status(403).json({ error: "Verificacion fallida" });
  } catch (error) {
    console.error("[WhatsApp Webhook] Error en verificacion:", error);
    res.status(500).json({ error: "Error interno en verificacion" });
  }
}

export async function receiveMessage(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;

    console.log("[WhatsApp Webhook] Evento entrante:", JSON.stringify(body, null, 2));

    if (!body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      console.log("[WhatsApp Webhook] Evento sin mensaje (puede ser status/delivery)");
      res.sendStatus(200);
      return;
    }

    const message = body.entry[0].changes[0].value.messages[0];
    const from: string | undefined = message?.from;
    const messageId: string | undefined = message?.id;
    const messageType: string = message?.type || "text";

    res.sendStatus(200);

    if (!from) {
      console.warn("[WhatsApp Webhook] Mensaje sin remitente (from), no se envia respuesta");
      return;
    }

    const normalizedPhone = from.replace(/\D/g, "");
    const conversationId = `conv_${normalizedPhone}`;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const isInteractiveReply = messageType === "interactive" && message?.interactive?.type === "button_reply";
    const buttonId: string | null = isInteractiveReply ? message?.interactive?.button_reply?.id || null : null;
    const buttonTitle: string = isInteractiveReply ? message?.interactive?.button_reply?.title || "" : "";

    // Determine the message body to store
    const textBody = message?.text?.body || "";
    const displayBody = isInteractiveReply
      ? `[Botón: ${buttonTitle}]`
      : (textBody || message?.caption || "[Mensaje interactivo/multimedia]");

    console.log(`[WhatsApp Webhook] Mensaje de ${from} (ID: ${messageId}, tipo: ${messageType}${buttonId ? `, boton: ${buttonId}` : ""}): "${displayBody}"`);

    try {
      await prisma.whatsAppMessage.create({
        data: {
          waMessageId: messageId || `wamid.in.${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          from,
          to: process.env.WHATSAPP_PHONE_NUMBER_ID || "WineSpa",
          body: displayBody,
          direction: "INBOUND",
          status: "RECEIVED",
          conversationId,
        },
      });
    } catch (dbErr) {
      console.error("[WhatsApp Webhook] Error guardando mensaje en DB:", dbErr);
    }

    void (async () => {
      try {
        if (isInteractiveReply && buttonId) {
          await handleButtonReply(from, buttonId, conversationId, frontendUrl);
        } else {
          await handleTextMessage(from, conversationId, frontendUrl);
        }
      } catch (err) {
        console.error(`[WhatsApp Webhook] Error enviando respuesta a ${from}:`, err);
      }
    })();
  } catch (error) {
    console.error("[WhatsApp Webhook] Error procesando mensaje:", error);
    res.sendStatus(200);
  }
}

async function handleTextMessage(to: string, conversationId: string, frontendUrl: string): Promise<void> {
  console.log(`[WhatsApp Webhook] Enviando menu de opciones a ${to}...`);

  const template = await prisma.whatsAppTemplate.findFirst({
    where: { name: "welcome", isActive: true },
  });

  const headerText = template?.headerText || "WineSpa";
  const bodyText = template?.bodyText || "¡Bienvenida a WineSpa! Tu espacio premium para el cuidado de uñas. ¿Como podemos ayudarte hoy?";
  const buttons = [
    { id: template?.button1Id || "agendar_cita", title: template?.button1Title || "Agendar Cita" },
    { id: template?.button2Id || "modificar_cita", title: template?.button2Title || "Modificar Cita" },
    { id: template?.button3Id || "solicitar_asesor", title: template?.button3Title || "Solicitar Asesor" },
  ];

  await sendButtonMessage(to, headerText, bodyText, buttons);
}

async function handleButtonReply(
  to: string,
  buttonId: string,
  conversationId: string,
  frontendUrl: string,
): Promise<void> {
  console.log(`[WhatsApp Webhook] Procesando boton "${buttonId}" de ${to}...`);

  switch (buttonId) {
    case "agendar_cita": {
      const bookingUrl = `${frontendUrl}?view=booking`;
      await sendInteractiveMessage(
        to,
        "Agenda tu Cita",
        "Reserva tu servicio de uñas de forma rapida y facil. Elige entre Manicure Tradicional, Semipermanente, Pedicure Premium y Unias Esculpidas en Gel.",
        "Agendar Ahora",
        bookingUrl,
      );
      break;
    }

    case "modificar_cita": {
      const portalUrl = `${frontendUrl}?view=clientPortal`;
      await sendInteractiveMessage(
        to,
        "Modifica tu Cita",
        "Ingresa a tu portal de cliente para ver, modificar o cancelar tus citas agendadas. Necesitaras tu numero de telefono para acceder.",
        "Ir a Mis Citas",
        portalUrl,
      );
      break;
    }

    case "solicitar_asesor": {
      // Flag the conversation so admin sees an alert
      try {
        await prisma.whatsAppMessage.create({
          data: {
            waMessageId: `wamid.flag.${Date.now()}`,
            from: "WineSpa",
            to,
            body: "El cliente solicito atencion de un asesor.",
            direction: "OUTBOUND",
            status: "SENT",
            conversationId,
            flagged: true,
          },
        });
      } catch (dbErr) {
        console.error("[WhatsApp Webhook] Error guardando flag de asesor:", dbErr);
      }

      await sendMessage(
        to,
        "Un asesor de WineSpa revisara tu caso y te contactara por este medio lo mas pronto posible. ¡Gracias por tu paciencia!",
      );
      break;
    }

    default:
      console.log(`[WhatsApp Webhook] Boton desconocido "${buttonId}", reenviando menu...`);
      await handleTextMessage(to, conversationId, frontendUrl);
  }
}
