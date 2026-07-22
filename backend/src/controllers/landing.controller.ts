import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export async function getLandingContent(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const content = await prisma.landingContent.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    });
    res.json(content);
  } catch (error) {
    console.error("Error obteniendo landing content:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
