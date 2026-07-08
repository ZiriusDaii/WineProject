import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const isValidPhone = (phone: string) => /^\d{7,10}$/.test(phone);

export async function getServices(req: Request, res: Response): Promise<void> {
  try {
    const hasPagination = req.query.page || req.query.limit || req.query.search;

    if (!hasPagination) {
      const services = await prisma.service.findMany({
        select: {
          id: true,
          name: true,
          shortDescription: true,
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
  _req: Request,
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

    const appointment = await prisma.appointment.create({
      data: {
        clientId: clientId!,
        manicuristId: manicuristId!,
        date: new Date(date!),
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

export async function getClientAppointments(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const clientId = (req.params.clientId ?? req.query.clientId) as string | undefined;

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
