import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export async function getManicuristDashboard(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { month, year, date, manicuristId } = req.query as {
      month?: string;
      year?: string;
      date?: string;
      manicuristId?: string;
    };

    if (!manicuristId) {
      res.status(400).json({ error: "El query param 'manicuristId' es requerido" });
      return;
    }

    let dateFilter: { gte: Date; lte: Date };

    if (date) {
      const d = new Date(date as string);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      dateFilter = { gte: startOfDay, lte: endOfDay };
    } else if (month && year) {
      const m = Number(month);
      const y = Number(year);
      dateFilter = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59, 999),
      };
    } else {
      res.status(400).json({ error: "Se requiere 'month' y 'year', o 'date' como query params" });
      return;
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        manicuristId,
        date: dateFilter,
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        services: true,
      },
      orderBy: { date: "asc" },
    });

    const now = new Date();

    const mapped = appointments.map((appt) => {
      const appointmentDate = new Date(appt.date);
      const endDate = new Date(
        appointmentDate.getTime() + appt.totalDuration * 60 * 1000,
      );

      if (appt.status === "PENDING" && now >= appointmentDate && now < endDate) {
        return { ...appt, status: "IN_PROGRESS" as const };
      }

      return appt;
    });

    res.json(mapped);
  } catch (error) {
    console.error("Error obteniendo dashboard de manicurista:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function completeAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };

    if (!id) {
      res.status(400).json({ error: "El parámetro 'id' es requerido" });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "COMPLETED" },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        manicurist: { select: { id: true, name: true } },
        services: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error completando cita:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function updateManicuristProfile(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id, name, age, gender, avatarPath } = req.body as {
      id?: string;
      name?: string;
      age?: number | null;
      gender?: string | null;
      avatarPath?: string | null;
    };

    if (!id) {
      res.status(400).json({ error: "El campo 'id' es requerido" });
      return;
    }

    if (avatarPath !== undefined && avatarPath !== null && !avatarPath.startsWith("/uploads/")) {
      res.status(400).json({ error: "avatarPath debe ser una ruta relativa dentro de /uploads/" });
      return;
    }

    if (age != null && (age < 0 || age > 100)) {
      res.status(400).json({ error: "El campo 'age' esta fuera de rango" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(age !== undefined && { age }),
        ...(gender !== undefined && { gender }),
        ...(avatarPath !== undefined && { avatarPath }),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        age: true,
        gender: true,
        avatarPath: true,
        role: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error actualizando perfil:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
