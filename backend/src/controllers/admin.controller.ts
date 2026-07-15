import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { getISOWeek } from "../lib/week.js";

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
    const { name, shortDescription, includesDescription, category, imageUrl, price, durationInMinutes, trending } = req.body as {
      name?: string;
      shortDescription?: string;
      includesDescription?: string | null;
      category?: string | null;
      imageUrl?: string | null;
      price?: number;
      durationInMinutes?: number;
      trending?: boolean;
    };

    if (!name || price == null || durationInMinutes == null) {
      res
        .status(400)
        .json({ error: "Faltan campos requeridos: name, price, durationInMinutes" });
      return;
    }

    if (typeof price !== "number" || price < 0 || !Number.isFinite(price)) {
      res.status(400).json({ error: "El precio debe ser un numero positivo" });
      return;
    }
    if (typeof durationInMinutes !== "number" || durationInMinutes <= 0 || !Number.isFinite(durationInMinutes)) {
      res.status(400).json({ error: "La duracion debe ser un numero positivo de minutos" });
      return;
    }

    const dup = await prisma.service.findFirst({
      where: { name, category: category || null },
    });
    if (dup) {
      res.status(409).json({ error: "Ya existe un servicio con el mismo nombre en esa categoria" });
      return;
    }

    const service = await prisma.service.create({
      data: {
        name,
        shortDescription: shortDescription ?? null,
        includesDescription: includesDescription ?? null,
        category: category ?? null,
        imageUrl: imageUrl ?? null,
        price,
        durationInMinutes,
        trending: trending ?? false,
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
    const { title, description, discountPercentage, code, isActive, validFrom, validUntil, newUsersOnly } =
      req.body as {
        title?: string;
        description?: string;
        discountPercentage?: number;
        code?: string;
        isActive?: boolean;
        validFrom?: string | null;
        validUntil?: string | null;
        newUsersOnly?: boolean;
      };

    if (!title || discountPercentage == null || !code) {
      res
        .status(400)
        .json({ error: "Faltan campos requeridos: title, discountPercentage, code" });
      return;
    }

    if (typeof discountPercentage !== "number" || discountPercentage < 1 || discountPercentage > 100) {
      res.status(400).json({ error: "El descuento debe ser un numero entre 1 y 100" });
      return;
    }

    const offer = await prisma.specialOffer.create({
      data: {
        title,
        description: description ?? null,
        discountPercentage,
        code,
        isActive: isActive ?? true,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        newUsersOnly: newUsersOnly ?? false,
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

    const ALLOWED_ROLES = ["ADMIN", "MANICURISTA"];
    if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
      res.status(400).json({ error: `Rol invalido. Permitidos: ${ALLOWED_ROLES.join(", ")}` });
      return;
    }

    if (age != null && (age < 0 || age > 100)) {
      res.status(400).json({ error: "El campo 'age' esta fuera de rango" });
      return;
    }

    if (id) {
      if (!phone || !username || !name) {
        res.status(400).json({
          error: "Faltan campos requeridos: phone, username, name",
        });
        return;
      }

      const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

      const updated = await prisma.user.update({
        where: { id },
        data: {
          phone,
          username,
          ...(hashedPassword !== undefined && { password: hashedPassword }),
          name,
          ...(age !== undefined && { age: age ?? null }),
          ...(gender !== undefined && { gender: gender ?? null }),
          ...(avatarPath !== undefined && { avatarPath: avatarPath ?? null }),
          ...(role !== undefined && { role: { set: role as "ADMIN" | "MANICURISTA" } }),
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
      if (!phone || !username || !password || !name) {
        res.status(400).json({
          error: "Faltan campos requeridos: phone, username, password, name",
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const created = await prisma.user.create({
        data: {
          phone,
          username,
          password: hashedPassword,
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

export async function deleteLandingContent(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };

    const existing = await prisma.landingContent.findUnique({ where: { id: id! } });
    if (!existing) {
      res.status(404).json({ error: "Contenido no encontrado" });
      return;
    }

    await prisma.landingContent.delete({ where: { id: id! } });

    res.json({ message: "Contenido eliminado exitosamente" });
  } catch (error) {
    console.error("Error eliminando landing content:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function updateService(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };
    const { name, shortDescription, includesDescription, category, imageUrl, price, durationInMinutes, trending } =
      req.body as {
        name?: string;
        shortDescription?: string | null;
        includesDescription?: string | null;
        category?: string | null;
        imageUrl?: string | null;
        price?: number;
        durationInMinutes?: number;
        trending?: boolean;
      };

    const existing = await prisma.service.findUnique({ where: { id: id! } });
    if (!existing) {
      res.status(404).json({ error: "Servicio no encontrado" });
      return;
    }

    if (name || category !== undefined) {
      const checkName = name || existing.name;
      const checkCat = category !== undefined ? (category || null) : existing.category;
      const dup = await prisma.service.findFirst({
        where: { name: checkName, category: checkCat, id: { not: id! } },
      });
      if (dup) {
        res.status(409).json({ error: "Ya existe un servicio con el mismo nombre en esa categoria" });
        return;
      }
    }

    const updated = await prisma.service.update({
      where: { id: id! },
      data: {
        ...(name !== undefined && { name }),
        ...(shortDescription !== undefined && { shortDescription }),
        ...(includesDescription !== undefined && { includesDescription }),
        ...(category !== undefined && { category }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(price !== undefined && { price }),
        ...(durationInMinutes !== undefined && { durationInMinutes }),
        ...(trending !== undefined && { trending }),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error actualizando servicio:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function deleteService(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };

    const existing = await prisma.service.findUnique({
      where: { id: id! },
      include: { appointments: { select: { id: true } } },
    });

    if (!existing) {
      res.status(404).json({ error: "Servicio no encontrado" });
      return;
    }

    if (existing.appointments.length > 0) {
      res.status(409).json({
        error: "No se puede eliminar el servicio porque tiene citas asociadas",
      });
      return;
    }

    await prisma.service.delete({ where: { id: id! } });

    res.json({ message: "Servicio eliminado exitosamente" });
  } catch (error) {
    console.error("Error eliminando servicio:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function updateSpecialOffer(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };
    const { title, description, discountPercentage, code, isActive, validFrom, validUntil, newUsersOnly } =
      req.body as {
        title?: string;
        description?: string | null;
        discountPercentage?: number;
        code?: string;
        isActive?: boolean;
        validFrom?: string | null;
        validUntil?: string | null;
        newUsersOnly?: boolean;
      };

    const existing = await prisma.specialOffer.findUnique({ where: { id: id! } });
    if (!existing) {
      res.status(404).json({ error: "Oferta no encontrada" });
      return;
    }

    const updated = await prisma.specialOffer.update({
      where: { id: id! },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(discountPercentage !== undefined && { discountPercentage }),
        ...(code !== undefined && { code }),
        ...(isActive !== undefined && { isActive }),
        ...(validFrom !== undefined && { validFrom: validFrom ? new Date(validFrom) : null }),
        ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
        ...(newUsersOnly !== undefined && { newUsersOnly }),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error actualizando oferta:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function deleteSpecialOffer(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };

    const existing = await prisma.specialOffer.findUnique({ where: { id: id! } });
    if (!existing) {
      res.status(404).json({ error: "Oferta no encontrada" });
      return;
    }

    await prisma.specialOffer.delete({ where: { id: id! } });

    res.json({ message: "Oferta eliminada exitosamente" });
  } catch (error) {
    console.error("Error eliminando oferta:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function getAdminOffers(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const offers = await prisma.specialOffer.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(offers);
  } catch (error) {
    console.error("Error obteniendo ofertas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

const VALID_APPOINTMENT_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export async function updateAppointmentStatus(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };
    const { status } = req.body as { status?: string };

    if (!id || !status) {
      res.status(400).json({ error: "Los campos 'id' y 'status' son requeridos" });
      return;
    }

    if (!(VALID_APPOINTMENT_STATUSES as readonly string[]).includes(status)) {
      res.status(400).json({ error: `Estado inválido. Válidos: ${VALID_APPOINTMENT_STATUSES.join(", ")}` });
      return;
    }

    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Cita no encontrada" });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: status as typeof VALID_APPOINTMENT_STATUSES[number] },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        manicurist: { select: { id: true, name: true } },
        services: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error actualizando estado de cita:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// ── Admin: Categorias de Servicios ──

export async function getServiceCategories(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const categories = await prisma.serviceCategory.findMany({
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (error) {
    console.error("Error obteniendo categorias:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function createServiceCategory(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) {
      res.status(400).json({ error: "El campo name es requerido" });
      return;
    }
    const existing = await prisma.serviceCategory.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      res.status(409).json({ error: "Ya existe una categoria con ese nombre" });
      return;
    }
    const cat = await prisma.serviceCategory.create({
      data: { name: name.trim() },
    });
    res.status(201).json(cat);
  } catch (error) {
    console.error("Error creando categoria:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function updateServiceCategory(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) {
      res.status(400).json({ error: "El campo name es requerido" });
      return;
    }
    const dup = await prisma.serviceCategory.findFirst({
      where: { name: name.trim(), id: { not: id! } },
    });
    if (dup) {
      res.status(409).json({ error: "Ya existe una categoria con ese nombre" });
      return;
    }
    const updated = await prisma.serviceCategory.update({
      where: { id: id! },
      data: { name: name.trim() },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error actualizando categoria:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function deleteServiceCategory(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };
    const cat = await prisma.serviceCategory.findUnique({ where: { id: id! } });
    if (!cat) {
      res.status(404).json({ error: "Categoria no encontrada" });
      return;
    }
    await prisma.serviceCategory.delete({ where: { id: id! } });
    res.json({ ok: true });
  } catch (error) {
    console.error("Error eliminando categoria:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// --- Turnos (ShiftTemplate + ManicuristSchedule) ---

export async function getShiftTemplates(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const templates = await prisma.shiftTemplate.findMany({ orderBy: { startTime: "asc" } });
    res.json(templates);
  } catch (error) {
    console.error("Error obteniendo turnos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function createShiftTemplate(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { name, startTime, endTime } = req.body as {
      name?: string;
      startTime?: string;
      endTime?: string;
    };
    if (!name || !startTime || !endTime) {
      res.status(400).json({ error: "Faltan campos requeridos: name, startTime, endTime" });
      return;
    }
    const created = await prisma.shiftTemplate.create({ data: { name, startTime, endTime } });
    res.status(201).json(created);
  } catch (error) {
    console.error("Error creando turno:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function updateShiftTemplate(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };
    const { name, startTime, endTime } = req.body as {
      name?: string;
      startTime?: string;
      endTime?: string;
    };
    const updated = await prisma.shiftTemplate.update({
      where: { id: id! },
      data: {
        ...(name !== undefined && { name }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
      },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error actualizando turno:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function deleteShiftTemplate(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };
    await prisma.shiftTemplate.delete({ where: { id: id! } });
    res.json({ ok: true });
  } catch (error) {
    console.error("Error eliminando turno:", error);
    res.status(400).json({ error: "No se pudo eliminar (puede estar en uso por alguna manicurista)" });
  }
}

export async function getManicuristScheduleWeek(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const week = Number(req.query.week);
    const year = Number(req.query.year);
    if (!week || !year) {
      res.status(400).json({ error: "Los parametros 'week' y 'year' son requeridos" });
      return;
    }
    const schedules = await prisma.manicuristSchedule.findMany({
      where: { weekNumber: week, year },
      include: { shiftTemplate: true, manicurist: { select: { id: true, name: true } } },
    });
    res.json(schedules);
  } catch (error) {
    console.error("Error obteniendo horario semanal:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function assignManicuristSchedule(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { manicuristId, year, shiftTemplateId } = req.body as {
      manicuristId?: string;
      week?: number;
      year?: number;
      shiftTemplateId?: string | null;
    };
    if (!manicuristId || !year) {
      res.status(400).json({ error: "Faltan campos requeridos: manicuristId, year" });
      return;
    }
    if (!shiftTemplateId) {
      await prisma.manicuristSchedule.deleteMany({
        where: { manicuristId, year },
      });
      res.json({ message: "Turno removido para todo el año" });
      return;
    }
    const weeks = Array.from({ length: 53 }, (_, i) => i + 1);
    const operations = weeks.map(w => prisma.manicuristSchedule.upsert({
      where: { manicuristId_weekNumber_year: { manicuristId, weekNumber: w, year } },
      update: { shiftTemplateId },
      create: { manicuristId, weekNumber: w, year, shiftTemplateId }
    }));
    await prisma.$transaction(operations);
    res.json({ message: "Turno asignado para todo el año exitosamente" });
  } catch (error) {
    console.error("Error asignando turno:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export { getISOWeek };
