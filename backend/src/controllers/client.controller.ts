import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const isValidPhone = (phone: string) => /^\d{7,10}$/.test(phone);

// Horario del local (confirmado con el negocio, perfil de WhatsApp Business).
// 0=Domingo..6=Sabado.
const BUSINESS_HOURS: Record<number, { open: string; close: string }> = {
  0: { open: "09:00", close: "19:00" },
  1: { open: "09:00", close: "20:00" },
  2: { open: "09:00", close: "20:00" },
  3: { open: "09:00", close: "20:00" },
  4: { open: "09:00", close: "20:00" },
  5: { open: "09:00", close: "20:00" },
  6: { open: "09:00", close: "19:00" },
};

const timeToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
};

// Toda hora en esta app se maneja como el HH:mm literal embebido en el ISO string
// (mismo criterio que toDateLabel/toTimeLabel en el frontend), sin conversion de
// zona horaria -- getUTCHours/getUTCMinutes leen ese HH:mm tal cual.
function isWithinBusinessHours(date: Date, durationMinutes: number): boolean {
  const hours = BUSINESS_HOURS[date.getUTCDay()]!;
  const startMin = date.getUTCHours() * 60 + date.getUTCMinutes();
  return startMin >= timeToMinutes(hours.open) && startMin + durationMinutes <= timeToMinutes(hours.close);
}

async function findOverlappingAppointment(
  manicuristId: string,
  date: Date,
  durationMinutes: number,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const startMin = date.getUTCHours() * 60 + date.getUTCMinutes();
  const endMin = startMin + durationMinutes;

  const sameDayAppointments = await prisma.appointment.findMany({
    where: {
      manicuristId,
      status: { not: "CANCELLED" },
      date: { gte: dayStart, lt: dayEnd },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: { date: true, totalDuration: true },
  });

  return sameDayAppointments.some((appt) => {
    const apptStartMin = appt.date.getUTCHours() * 60 + appt.date.getUTCMinutes();
    const apptEndMin = apptStartMin + appt.totalDuration;
    return startMin < apptEndMin && apptStartMin < endMin;
  });
}

export async function getServices(req: Request, res: Response): Promise<void> {
  try {
    const hasPagination = req.query.page || req.query.limit || req.query.search;

    if (!hasPagination) {
      const services = await prisma.service.findMany({
        select: {
          id: true,
          name: true,
          shortDescription: true,
          includesDescription: true,
          category: true,
          imageUrl: true,
          price: true,
          durationInMinutes: true,
        },
        orderBy: { name: "asc" },
      });
      res.json(services);
      return;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim() || null;

    const where = search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {};

    const [data, totalCount] = await Promise.all([
      prisma.service.findMany({
        where,
        select: {
          id: true,
          name: true,
          shortDescription: true,
          includesDescription: true,
          category: true,
          imageUrl: true,
          price: true,
          durationInMinutes: true,
        },
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.service.count({ where }),
    ]);

    res.json({
      data,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error obteniendo servicios:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function getManicurists(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const manicurists = await prisma.user.findMany({
      where: { role: "MANICURISTA" },
      select: { id: true, name: true, avatarPath: true, age: true, gender: true },
    });
    res.json(manicurists);
  } catch (error) {
    console.error("Error obteniendo manicuristas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function getOffers(_req: Request, res: Response): Promise<void> {
  try {
    const offers = await prisma.specialOffer.findMany({
      where: { isActive: true },
    });
    res.json(offers);
  } catch (error) {
    console.error("Error obteniendo ofertas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function authClient(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { phone } = req.body as { phone?: string };

    if (!phone) {
      res.status(400).json({ error: "El campo 'phone' es requerido" });
      return;
    }

    if (!isValidPhone(phone)) {
      res.status(400).json({ error: "El campo 'phone' debe tener entre 7 y 10 digitos" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        name: true,
        phone: true,
        age: true,
        gender: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.json({ exists: false });
      return;
    }

    const appointments = await prisma.appointment.findMany({
      where: { clientId: user.id },
      include: {
        manicurist: { select: { id: true, name: true } },
        services: true,
      },
      orderBy: { date: "desc" },
    });

    res.json({
      exists: true,
      client: user,
      appointmentHistory: appointments,
    });
  } catch (error) {
    console.error("Error en authClient:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function createClient(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { phone, name, age, gender } = req.body as {
      phone?: string;
      name?: string;
      age?: number | null;
      gender?: string | null;
    };

    if (!phone || !name) {
      res
        .status(400)
        .json({ error: "Los campos 'phone' y 'name' son requeridos" });
      return;
    }

    if (!isValidPhone(phone)) {
      res.status(400).json({ error: "El campo 'phone' debe tener entre 7 y 10 digitos" });
      return;
    }

    if (name.length > 60) {
      res.status(400).json({ error: "El campo 'name' es demasiado largo" });
      return;
    }

    if (age != null && (age < 0 || age > 120)) {
      res.status(400).json({ error: "El campo 'age' esta fuera de rango" });
      return;
    }

    const client = await prisma.user.create({
      data: {
        phone,
        name,
        age: age ?? null,
        gender: gender ?? null,
        role: "CLIENTE",
      },
      select: { id: true, name: true, phone: true, age: true, gender: true },
    });

    res.status(201).json(client);
  } catch (error) {
    console.error("Error creando cliente:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function createAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { clientId, manicuristId, date, serviceIds } = req.body as {
      clientId?: string;
      manicuristId?: string;
      date?: string;
      serviceIds?: string[];
    };

    const missing: string[] = [];
    if (!clientId) missing.push("clientId");
    if (!manicuristId) missing.push("manicuristId");
    if (!date) missing.push("date");
    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      missing.push("serviceIds (no vacío)");
    }

    if (missing.length > 0) {
      console.error("createAppointment - campos faltantes:", missing, "body:", req.body);
      res.status(400).json({
        error: `Faltan campos requeridos: ${missing.join(", ")}`,
        missing,
      });
      return;
    }

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds! } },
    });

    if (services.length !== serviceIds!.length) {
      res.status(400).json({ error: "Uno o más serviceIds no existen" });
      return;
    }

    const totalDuration = services.reduce(
      (sum, s) => sum + s.durationInMinutes,
      0,
    );
    const totalPrice = services.reduce((sum, s) => sum + Number(s.price), 0);
    const parsedDate = new Date(date!);

    if (!isWithinBusinessHours(parsedDate, totalDuration)) {
      res.status(400).json({ error: "El horario elegido esta fuera del horario del local" });
      return;
    }

    if (await findOverlappingAppointment(manicuristId!, parsedDate, totalDuration)) {
      res.status(409).json({ error: "La manicurista ya tiene una cita en ese horario" });
      return;
    }

    const categoryGroups = new Map<string, typeof services>();
    for (const s of services) {
      if (s.category) {
        const group = categoryGroups.get(s.category);
        if (group) group.push(s);
        else categoryGroups.set(s.category, [s]);
      }
    }
    for (const [, svcs] of categoryGroups) {
      if (svcs.length > 1) {
        const names = svcs.map((s) => `'${s.name}'`).join(" y ");
        res.status(400).json({
          error: `No podés agendar ${names} juntos: son de la misma categoría`,
        });
        return;
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        clientId: clientId!,
        manicuristId: manicuristId!,
        date: parsedDate,
        totalDuration,
        totalPrice,
        status: "PENDING",
        services: {
          connect: serviceIds!.map((id) => ({ id })),
        },
      },
      include: {
        services: true,
        client: { select: { id: true, name: true, phone: true } },
        manicurist: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(appointment);
  } catch (error) {
    console.error("Error creando appointment:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function updateAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };
    const { status, date, manicuristId } = req.body as {
      status?: string;
      date?: string;
      manicuristId?: string;
    };

    if (!id) {
      res.status(400).json({ error: "El parametro 'id' es requerido" });
      return;
    }

    if (status && status !== "CANCELLED") {
      res.status(400).json({ error: "El estado solo puede ser 'CANCELLED'" });
      return;
    }

    const existing = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: "Cita no encontrada" });
      return;
    }

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (manicuristId) data.manicuristId = manicuristId;

    if (date || manicuristId) {
      const targetDate = date ? new Date(date) : existing.date;
      const targetManicuristId = manicuristId ?? existing.manicuristId;

      if (!isWithinBusinessHours(targetDate, existing.totalDuration)) {
        res.status(400).json({ error: "El horario elegido esta fuera del horario del local" });
        return;
      }

      if (await findOverlappingAppointment(targetManicuristId, targetDate, existing.totalDuration, id)) {
        res.status(409).json({ error: "La manicurista ya tiene una cita en ese horario" });
        return;
      }

      if (date) data.date = targetDate;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        manicurist: { select: { id: true, name: true } },
        services: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error actualizando cita:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function getClientAppointments(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const clientId = (req.params.clientId ?? req.query.clientId) as string | undefined;
    const date = req.query.date as string | undefined;
    const manicuristId = req.query.manicuristId as string | undefined;
    const excludeId = req.query.excludeId as string | undefined;

    if (date || manicuristId) {
      const where: Record<string, unknown> = { status: { not: "CANCELLED" } };

      if (excludeId) {
        where.id = { not: excludeId };
      }

      if (date) {
        const startOfDay = new Date(`${date}T00:00:00.000Z`);
        const endOfDay = new Date(`${date}T23:59:59.999Z`);
        where.date = { gte: startOfDay, lte: endOfDay };
      }

      if (manicuristId) {
        where.manicuristId = manicuristId;
      }

      const appointments = await prisma.appointment.findMany({
        where,
        select: {
          id: true,
          date: true,
          totalDuration: true,
          services: true,
        },
        orderBy: { date: "asc" },
      });

      res.json(appointments);
      return;
    }

    if (!clientId) {
      res.status(400).json({ error: "El identificador 'clientId' es requerido" });
      return;
    }

    const appointments = await prisma.appointment.findMany({
      where: { clientId },
      include: {
        manicurist: { select: { id: true, name: true, avatarPath: true } },
        services: true,
      },
      orderBy: { date: "desc" },
    });

    res.json(appointments);
  } catch (error) {
    console.error("Error obteniendo citas del cliente:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function uploadManicuristAvatar(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const file = req.file;
    const { manicuristId } = req.body as { manicuristId?: string };

    if (!file) {
      res.status(400).json({ error: "No se recibió ninguna imagen" });
      return;
    }

    if (!manicuristId) {
      res.status(400).json({ error: "El campo 'manicuristId' es requerido" });
      return;
    }

    const avatarPath = `/uploads/${file.filename}`;

    const updated = await prisma.user.update({
      where: { id: manicuristId },
      data: { avatarPath },
      select: {
        id: true,
        name: true,
        avatarPath: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error subiendo avatar:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function uploadLandingImage(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No se recibió ninguna imagen" });
      return;
    }

    const imageUrl = `/uploads/${file.filename}`;

    res.json({ imageUrl });
  } catch (error) {
    console.error("Error subiendo imagen:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function validateOfferCode(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { code } = req.body as { code?: string };

    if (!code) {
      res.status(400).json({ error: "El campo 'code' es requerido" });
      return;
    }

    const offer = await prisma.specialOffer.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!offer) {
      res.status(404).json({ error: "Código no encontrado" });
      return;
    }

    if (!offer.isActive) {
      res.status(400).json({ error: "Esta oferta ya no está vigente" });
      return;
    }

    res.json({
      valid: true,
      discountPercentage: offer.discountPercentage,
      title: offer.title,
      description: offer.description,
    });
  } catch (error) {
    console.error("Error validando código de oferta:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
