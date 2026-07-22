import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export async function getLandingContent(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userRole = (req as any).user?.role;
    const isStaffRequest = userRole === "ADMIN" || userRole === "OWNER" || userRole === "MANICURISTA";
    const where = isStaffRequest ? {} : { isActive: true };
    const content = await prisma.landingContent.findMany({
      where,
      orderBy: { order: "asc" },
    });
    res.json(content);
  } catch (error) {
    console.error("Error obteniendo landing content:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
