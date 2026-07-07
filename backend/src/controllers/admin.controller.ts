import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export async function getDashboardStats(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const earnings = await prisma.appointment.aggregate({
      _sum: { totalPrice: true },
      where: { status: { in: ["COMPLETED", "IN_PROGRESS"] } },
    });

    const byStatus = await prisma.appointment.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const performanceRaw = await prisma.appointment.groupBy({
      by: ["manicuristId"],
      _count: { id: true },
      where: { status: "COMPLETED" },
    });

    const manicuristIds = performanceRaw.map((p) => p.manicuristId);

    const users = await prisma.user.findMany({
      where: { id: { in: manicuristIds } },
      select: { id: true, name: true },
    });

    const performance = users.map((u) => {
      const record = performanceRaw.find((p) => p.manicuristId === u.id);
      return {
        id: u.id,
        name: u.name,
        completedAppointments: record?._count.id ?? 0,
      };
    });

    res.json({
      totalEarnings: earnings._sum.totalPrice ?? 0,
      appointmentsByStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      manicuristPerformance: performance,
    });
  } catch (error) {
    console.error("Error obteniendo dashboard stats:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function getAllAppointments(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim() || null;

    const where = search
      ? {
          OR: [
            { client: { name: { contains: search, mode: "insensitive" as const } } },
            { client: { phone: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {};

    const [data, totalCount] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, phone: true } },
          manicurist: { select: { id: true, name: true } },
          services: true,
        },
        skip,
        take: limit,
        orderBy: { date: "desc" },
      }),
      prisma.appointment.count({ where }),
    ]);

    res.json({
      data,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error obteniendo appointments:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function createService(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { name, shortDescription, price, durationInMinutes } = req.body as {
      name?: string;
      shortDescription?: string;
      price?: number;
      durationInMinutes?: number;
    };

    if (!name || price == null || durationInMinutes == null) {
      res
        .status(400)
        .json({ error: "Faltan campos requeridos: name, price, durationInMinutes" });
      return;
    }

    const service = await prisma.service.create({
      data: {
        name,
        shortDescription: shortDescription ?? null,
        price,
        durationInMinutes,
      },
    });

    res.status(201).json(service);
  } catch (error) {
    console.error("Error creando servicio:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function createSpecialOffer(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { title, description, discountPercentage, code, isActive } =
      req.body as {
        title?: string;
        description?: string;
        discountPercentage?: number;
        code?: string;
        isActive?: boolean;
      };

    if (!title || discountPercentage == null || !code) {
      res
        .status(400)
        .json({ error: "Faltan campos requeridos: title, discountPercentage, code" });
      return;
    }

    const offer = await prisma.specialOffer.create({
      data: {
        title,
        description: description ?? null,
        discountPercentage,
        code,
        isActive: isActive ?? true,
      },
    });

    res.status(201).json(offer);
  } catch (error) {
    console.error("Error creando oferta:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function getAdminUsers(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim() || null;

    const searchWhere = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const baseWhere = { role: "CLIENTE" as const };
    const where = { ...baseWhere, ...searchWhere };

    const [data, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          phone: true,
          name: true,
          age: true,
          gender: true,
          role: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error obteniendo clientes:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function getAdminManicurists(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const manicurists = await prisma.user.findMany({
      where: { role: "MANICURISTA" },
      select: {
        id: true,
        username: true,
        phone: true,
        name: true,
        age: true,
        gender: true,
        avatarPath: true,
        role: true,
        createdAt: true,
        schedules: {
          include: { shiftTemplate: true },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json(manicurists);
  } catch (error) {
    console.error("Error obteniendo manicuristas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function updateManicuristStatus(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };
    const { phone, username, password, name, age, gender, avatarPath, role } =
      req.body as {
        phone?: string;
        username?: string;
        password?: string;
        name?: string;
        age?: number | null;
        gender?: string | null;
        avatarPath?: string | null;
        role?: string;
      };

    if (!phone || !username || !password || !name) {
      res.status(400).json({
        error: "Faltan campos requeridos: phone, username, password, name",
      });
      return;
    }

    if (id) {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          phone,
          username,
          password,
          name,
          age: age ?? null,
          gender: gender ?? null,
          avatarPath: avatarPath ?? null,
          role: role ? { set: role as "ADMIN" | "MANICURISTA" } : undefined,
        },
        select: {
          id: true,
          username: true,
          phone: true,
          name: true,
          age: true,
          gender: true,
          avatarPath: true,
          role: true,
        },
      });
      res.json(updated);
    } else {
      const created = await prisma.user.create({
        data: {
          phone,
          username,
          password,
          name,
          age: age ?? null,
          gender: gender ?? null,
          avatarPath: avatarPath ?? null,
          role: (role as "ADMIN" | "MANICURISTA") ?? "MANICURISTA",
        },
        select: {
          id: true,
          username: true,
          phone: true,
          name: true,
          age: true,
          gender: true,
          avatarPath: true,
          role: true,
        },
      });
      res.status(201).json(created);
    }
  } catch (error) {
    console.error("Error gestionando manicurista:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function manageLandingContent(
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
    console.error("Error gestionando landing content:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
