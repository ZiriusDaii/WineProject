import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { sendInteractiveMessage } from "../services/whatsapp.service.js";

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
    const messageBody: string = message?.text?.body || message?.caption || "[Mensaje interactivo/multimedia]";

    console.log(`[WhatsApp Webhook] Mensaje de ${from} (ID: ${messageId}): "${messageBody}"`);

    res.sendStatus(200);

    if (!from) {
      console.warn("[WhatsApp Webhook] Mensaje sin remitente (from), no se envia respuesta");
      return;
    }

    const normalizedPhone = from.replace(/\D/g, "");
    const conversationId = `conv_${normalizedPhone}`;

    try {
      await prisma.whatsAppMessage.create({
        data: {
          waMessageId: messageId || `wamid.in.${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          from,
          to: process.env.WHATSAPP_PHONE_NUMBER_ID || "WineSpa",
          body: messageBody,
          direction: "INBOUND",
          status: "RECEIVED",
          conversationId,
        },
      });
    } catch (dbErr) {
      console.error("[WhatsApp Webhook] Error guardando mensaje en DB:", dbErr);
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    void (async () => {
      try {
        console.log(`[WhatsApp Webhook] Procesando respuesta asincrona para ${from}...`);
        await sendInteractiveMessage(
          from,
          "WineSpa",
          "¡Bienvenida a WineSpa! Tu espacio premium para el cuidado de uñas. Reserva tu cita facil y rapido desde nuestra app.",
          "Agendar Cita",
          frontendUrl,
        );
      } catch (err) {
        console.error(`[WhatsApp Webhook] Error enviando respuesta asincrona a ${from}:`, err);
      }
    })();
  } catch (error) {
    console.error("[WhatsApp Webhook] Error procesando mensaje:", error);
    res.sendStatus(200);
  }
}
