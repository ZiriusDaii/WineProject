import type { Request, Response } from "express";
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
    const from = message.from;
    const messageId = message.id;
    const messageBody = message.text?.body || "";

    console.log(`[WhatsApp Webhook] Mensaje de ${from} (ID: ${messageId}): "${messageBody}"`);

    res.sendStatus(200);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    // Procesamiento asincrono: no bloquea la respuesta a Meta
    setImmediate(async () => {
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
    });
  } catch (error) {
    console.error("[WhatsApp Webhook] Error procesando mensaje:", error);
    res.sendStatus(200);
  }
}
