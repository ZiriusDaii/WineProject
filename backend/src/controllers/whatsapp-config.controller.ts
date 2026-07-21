import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export async function getTemplates(_req: Request, res: Response): Promise<void> {
  try {
    const templates = await prisma.whatsAppTemplate.findMany({
      orderBy: { updatedAt: "desc" },
    });
    res.status(200).json({ templates });
  } catch (error) {
    console.error("[WhatsApp Config] Error obteniendo templates:", error);
    res.status(500).json({ error: "Error al obtener templates" });
  }
}

export async function updateTemplate(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : String(rawId || "");
    const { headerText, bodyText, button1Id, button1Title, button2Id, button2Title, button3Id, button3Title, isActive } = req.body;

    if (!id) {
      res.status(400).json({ error: "ID de template requerido" });
      return;
    }

    const existing = await prisma.whatsAppTemplate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Template no encontrado" });
      return;
    }

    const template = await prisma.whatsAppTemplate.update({
      where: { id },
      data: {
        ...(headerText !== undefined && { headerText }),
        ...(bodyText !== undefined && { bodyText }),
        ...(button1Id !== undefined && { button1Id }),
        ...(button1Title !== undefined && { button1Title }),
        ...(button2Id !== undefined && { button2Id }),
        ...(button2Title !== undefined && { button2Title }),
        ...(button3Id !== undefined && { button3Id }),
        ...(button3Title !== undefined && { button3Title }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.status(200).json({ template });
  } catch (error) {
    console.error("[WhatsApp Config] Error actualizando template:", error);
    res.status(500).json({ error: "Error al actualizar template" });
  }
}

export async function getWelcomeTemplate() {
  return prisma.whatsAppTemplate.findFirst({
    where: { name: "welcome", isActive: true },
  });
}
