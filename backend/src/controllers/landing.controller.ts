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

export async function updateLandingContent(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const items = req.body as {
      id?: string | null;
      type: string;
      title: string;
      description?: string | null;
      imageUrl: string;
      order?: number;
      isActive?: boolean;
    }[];

    if (!Array.isArray(items) || items.length === 0) {
      res
        .status(400)
        .json({ error: "Se requiere un arreglo no vacío de contenidos" });
      return;
    }

    const results = await prisma.$transaction(
      items.map((item) => {
        const { id, ...data } = item;
        return prisma.landingContent.upsert({
          where: { id: id ?? "" },
          update: {
            type: data.type,
            title: data.title,
            description: data.description ?? null,
            imageUrl: data.imageUrl,
            order: data.order ?? 0,
            isActive: data.isActive ?? true,
          },
          create: {
            type: data.type,
            title: data.title,
            description: data.description ?? null,
            imageUrl: data.imageUrl,
            order: data.order ?? 0,
            isActive: data.isActive ?? true,
          },
        });
      }),
    );

    res.json(results);
  } catch (error) {
    console.error("Error actualizando landing content:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
