import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { sendMessage } from "../services/whatsapp.service.js";

export async function listConversations(req: Request, res: Response): Promise<void> {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 50));

    // Group by conversationId to get the latest message timestamp per conversation
    const groups = await prisma.whatsAppMessage.groupBy({
      by: ["conversationId"],
      _max: { createdAt: true },
      _count: { id: true },
    });

    if (groups.length === 0) {
      res.status(200).json({ conversations: [], total: 0, page, limit });
      return;
    }

    // Fetch all users to map names and roles
    const users = await prisma.user.findMany({
      select: { phone: true, name: true, role: true },
    });

    const userMap = new Map<string, { name: string; role: string }>();
    for (const u of users) {
      const norm = u.phone.replace(/\D/g, "");
      userMap.set(norm, { name: u.name, role: u.role });
      userMap.set(u.phone, { name: u.name, role: u.role });
    }

    // For each group, get the latest message and unread count
    const conversationList = await Promise.all(
      groups.map(async (group) => {
        const conversationId = group.conversationId;
        const lastMessageAt = group._max.createdAt || new Date();
        const totalMessages = group._count.id;

        const latestMsg = await prisma.whatsAppMessage.findFirst({
          where: { conversationId },
          orderBy: { createdAt: "desc" },
        });

        const unreadCount = await prisma.whatsAppMessage.count({
          where: {
            conversationId,
            direction: "INBOUND",
            status: { not: "READ" },
          },
        });

        const hasAttentionRequest = await prisma.whatsAppMessage.count({
          where: { conversationId, flagged: true },
        });

        const phoneNumber = conversationId.replace(/^conv_/, "");
        const matchedUser = userMap.get(phoneNumber) || userMap.get(`+${phoneNumber}`) || null;

        return {
          conversationId,
          phoneNumber: latestMsg?.direction === "INBOUND" ? latestMsg.from : (latestMsg?.to || phoneNumber),
          clientName: matchedUser?.name || undefined,
          clientRole: matchedUser?.role || undefined,
          lastMessage: latestMsg?.body || "",
          lastMessageAt: lastMessageAt.toISOString(),
          unreadCount,
          totalMessages,
          hasAttentionRequest: hasAttentionRequest > 0,
        };
      })
    );

    // Sort by lastMessageAt DESC
    conversationList.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    // Filter by search query if provided
    let filtered = conversationList;
    if (search) {
      filtered = conversationList.filter((c) => {
        const phoneMatch = c.phoneNumber.toLowerCase().includes(search);
        const nameMatch = c.clientName ? c.clientName.toLowerCase().includes(search) : false;
        const msgMatch = c.lastMessage.toLowerCase().includes(search);
        return phoneMatch || nameMatch || msgMatch;
      });
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginatedConversations = filtered.slice(startIndex, startIndex + limit);

    res.status(200).json({
      conversations: paginatedConversations,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[WhatsApp Admin Controller] Error en listConversations:", error);
    res.status(500).json({ error: "Error al obtener conversaciones de WhatsApp" });
  }
}

export async function getConversationMessages(req: Request, res: Response): Promise<void> {
  try {
    const rawConversationId = req.params.conversationId;
    const conversationId = Array.isArray(rawConversationId) ? rawConversationId[0] : String(rawConversationId || "");

    if (!conversationId) {
      res.status(400).json({ error: "conversationId es requerido" });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit as string) || 200));

    const total = await prisma.whatsAppMessage.count({
      where: { conversationId },
    });

    const messages = await prisma.whatsAppMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.status(200).json({
      messages,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[WhatsApp Admin Controller] Error en getConversationMessages:", error);
    res.status(500).json({ error: "Error al obtener mensajes de la conversacion" });
  }
}

export async function sendAdminReply(req: Request, res: Response): Promise<void> {
  try {
    const rawConversationId = req.params.conversationId;
    const conversationId = Array.isArray(rawConversationId) ? rawConversationId[0] : String(rawConversationId || "");
    const { messageText } = req.body;

    if (!conversationId || !messageText || typeof messageText !== "string" || !messageText.trim()) {
      res.status(400).json({ error: "Mensaje invalido o conversationId no provisto" });
      return;
    }

    // Determine target phone number
    let phoneNumber = conversationId.replace(/^conv_/, "");
    const latestMsg = await prisma.whatsAppMessage.findFirst({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
    });

    if (latestMsg) {
      phoneNumber = latestMsg.direction === "INBOUND" ? latestMsg.from : latestMsg.to;
    }

    let sendStatus: "SENT" | "FAILED" = "SENT";
    try {
      await sendMessage(phoneNumber, messageText.trim());
    } catch (err) {
      console.error(`[WhatsApp Admin Controller] Fallo envio a ${phoneNumber}:`, err);
      sendStatus = "FAILED";
    }

    const createdMessage = await prisma.whatsAppMessage.create({
      data: {
        waMessageId: `wamid.out.${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        from: "WineSpa",
        to: phoneNumber,
        body: messageText.trim(),
        direction: "OUTBOUND",
        status: sendStatus,
        conversationId,
      },
    });

    if (sendStatus === "FAILED") {
      res.status(500).json({
        error: "No se pudo enviar el mensaje por WhatsApp",
        message: createdMessage,
      });
      return;
    }

    res.status(201).json({ message: createdMessage });
  } catch (error) {
    console.error("[WhatsApp Admin Controller] Error en sendAdminReply:", error);
    res.status(500).json({ error: "Error interno al enviar la respuesta de admin" });
  }
}

export async function markConversationAsRead(req: Request, res: Response): Promise<void> {
  try {
    const rawConversationId = req.params.conversationId;
    const conversationId = Array.isArray(rawConversationId) ? rawConversationId[0] : String(rawConversationId || "");

    if (!conversationId) {
      res.status(400).json({ error: "conversationId es requerido" });
      return;
    }

    await prisma.whatsAppMessage.updateMany({
      where: {
        conversationId,
        direction: "INBOUND",
        status: { not: "READ" },
      },
      data: { status: "READ" },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[WhatsApp Admin Controller] Error en markConversationAsRead:", error);
    res.status(500).json({ error: "Error al marcar mensajes como leidos" });
  }
}

export async function resolveAttentionRequest(req: Request, res: Response): Promise<void> {
  try {
    const rawConversationId = req.params.conversationId;
    const conversationId = Array.isArray(rawConversationId) ? rawConversationId[0] : String(rawConversationId || "");

    if (!conversationId) {
      res.status(400).json({ error: "conversationId es requerido" });
      return;
    }

    await prisma.whatsAppMessage.updateMany({
      where: { conversationId, flagged: true },
      data: { flagged: false },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[WhatsApp Admin Controller] Error en resolveAttentionRequest:", error);
    res.status(500).json({ error: "Error al resolver solicitud de atencion" });
  }
}

export async function deleteConversation(req: Request, res: Response): Promise<void> {
  try {
    const rawConversationId = req.params.conversationId;
    const conversationId = Array.isArray(rawConversationId) ? rawConversationId[0] : String(rawConversationId || "");

    if (!conversationId) {
      res.status(400).json({ error: "conversationId es requerido" });
      return;
    }

    await prisma.whatsAppMessage.deleteMany({
      where: { conversationId },
    });

    console.log(`[WhatsApp Admin Controller] Conversacion eliminada: ${conversationId}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[WhatsApp Admin Controller] Error en deleteConversation:", error);
    res.status(500).json({ error: "Error al eliminar la conversacion" });
  }
}
