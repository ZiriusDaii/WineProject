import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { getISOWeek, isoWeekStart } from "../lib/week.js";

// toISOString()/slice(0,10) es siempre UTC; Colombia es UTC-5 sin horario de
// verano, asi que despues de las 7pm local la fecha UTC ya cayo en "manana".
// Se compara por componentes locales para no perder citas de la noche.
function toLocalDateStr(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function getManicuristDashboard(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { month, year, date } = req.query as {
      month?: string;
      year?: string;
      date?: string;
    };

    let effectiveManicuristId: string;

    if (req.user?.role === "MANICURISTA") {
      effectiveManicuristId = req.user.userId;
    } else {
      const requested = req.query.manicuristId;
      if (typeof requested !== "string" || !requested.trim()) {
        res.status(400).json({ error: "El parametro 'manicuristId' es requerido" });
        return;
      }
      effectiveManicuristId = requested.trim();

      const target = await prisma.user.findFirst({
        where: { id: effectiveManicuristId, role: "MANICURISTA" },
        select: { id: true },
      });
      if (!target) {
        res.status(404).json({ error: "Manicurista no encontrada" });
        return;
      }
    }

    let dateFilter: { gte: Date; lte: Date };
    // Solo se llena en modo 'date': el rango de dateFilter es un solo dia, asi
    // que las metricas "monthXxx" necesitan su propia consulta con alcance real
    // de mes (si no, "monthTotal" terminaba siendo igual a "todayTotal").
    let monthDateFilterForDateMode: { gte: Date; lte: Date } | null = null;

    if (date) {
      const d = new Date(date as string);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      dateFilter = { gte: startOfDay, lte: endOfDay };
      monthDateFilterForDateMode = {
        gte: new Date(d.getFullYear(), d.getMonth(), 1),
        lte: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
      };
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
        manicuristId: effectiveManicuristId,
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

    // Calcular el turno asignado (rotativo o con excepcion) para la semana actual
    const targetYear = year ? Number(year) : now.getFullYear();
    const targetMonth = month ? Number(month) : (now.getMonth() + 1);
    const refDate = date ? new Date(date) : new Date(targetYear, targetMonth - 1, 1);
    const { week: weekNum, year: yearNum } = getISOWeek(refDate);

    const manicuristUser = await prisma.user.findUnique({
      where: { id: effectiveManicuristId },
      include: {
        defaultShift: true,
        rotationShift1: true,
        rotationShift2: true,
        schedules: {
          where: { weekNumber: weekNum, year: yearNum },
          include: { shiftTemplate: true },
        },
      },
    });

    let currentShift = null;
    let isOverride = false;

    if (manicuristUser) {
      if (manicuristUser.schedules && manicuristUser.schedules.length > 0) {
        currentShift = manicuristUser.schedules[0]?.shiftTemplate ?? null;
        isOverride = true;
      } else {
        const rotType = manicuristUser.rotationType || "WEEKLY_ROTATION";
        if (rotType === "FIXED") {
          currentShift = manicuristUser.defaultShift;
        } else {
          const anchorW = manicuristUser.anchorWeek ?? 1;
          const anchorY = manicuristUser.anchorYear ?? 2026;
          // Diferencia en semanas reales entre fechas (no *52), para no perder
          // la paridad de la rotacion en anios ISO de 53 semanas (ej. 2026).
          const deltaWeeks = Math.round(
            (isoWeekStart(yearNum, weekNum).getTime() - isoWeekStart(anchorY, anchorW).getTime()) /
              (7 * 24 * 60 * 60 * 1000),
          );
          const cycleIndex = Math.abs(deltaWeeks) % 2;
          currentShift = cycleIndex === 0 ? manicuristUser.rotationShift1 : manicuristUser.rotationShift2;
        }
      }
    }

    if (!currentShift) {
      const fallbackShift = await prisma.shiftTemplate.findFirst({ orderBy: { startTime: "asc" } });
      if (fallbackShift) {
        currentShift = fallbackShift;
      } else {
        currentShift = { id: "default", name: "Turno General", startTime: "08:00", endTime: "16:00" };
      }
    }

    // Calcular resumen diario y mensual de citas / horas
    const todayISO = toLocalDateStr(now);
    const getISODateStr = toLocalDateStr;

    const isCompletedOrPast = (a: any) => {
      if (a.status === "CANCELLED") return false;
      if (a.status === "COMPLETED") return true;
      const apptDate = new Date(a.date);
      return apptDate < now;
    };

    const todayAppts = mapped.filter((a) => getISODateStr(a.date) === todayISO && a.status !== "CANCELLED");
    const todayCompleted = todayAppts.filter(isCompletedOrPast);
    const todayMinutes = todayCompleted.reduce((acc, a) => acc + (a.totalDuration || 60), 0);

    const monthSource = monthDateFilterForDateMode
      ? await prisma.appointment.findMany({
          where: { manicuristId: effectiveManicuristId, date: monthDateFilterForDateMode },
        })
      : appointments;
    const monthAppts = monthSource.filter((a) => a.status !== "CANCELLED");
    const monthCompleted = monthAppts.filter(isCompletedOrPast);
    const monthMinutes = monthCompleted.reduce((acc, a) => acc + (a.totalDuration || 60), 0);

    res.json({
      appointments: mapped,
      shift: currentShift ? {
        id: currentShift.id,
        name: currentShift.name,
        startTime: currentShift.startTime,
        endTime: currentShift.endTime,
        isOverride,
        weekNumber: weekNum,
        year: yearNum,
      } : null,
      summary: {
        todayTotal: todayAppts.length,
        todayCompleted: todayCompleted.length,
        todayHours: Math.round((todayMinutes / 60) * 10) / 10,
        monthTotal: monthAppts.length,
        monthCompleted: monthCompleted.length,
        monthHours: Math.round((monthMinutes / 60) * 10) / 10,
      },
    });
  } catch (error) {
    console.error("Error obteniendo dashboard de manicurista:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function startAppointment(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };

    if (!id) {
      res.status(400).json({ error: "El parametro 'id' es requerido" });
      return;
    }

    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Cita no encontrada" });
      return;
    }

    if (req.user?.role === "MANICURISTA" && existing.manicuristId !== req.user.userId) {
      res.status(403).json({ error: "No autorizado para modificar una cita de otra manicurista" });
      return;
    }

    if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
      res.status(409).json({ error: "La cita ya fue finalizada o cancelada" });
      return;
    }

    const apptDayStr = toLocalDateStr(existing.date);
    const todayStr = toLocalDateStr(new Date());

    if (apptDayStr > todayStr) {
      res.status(400).json({ error: "No se puede iniciar una cita programada para una fecha futura" });
      return;
    }

    // updateMany con filtro de estado en el where: si otra request concurrente
    // ya movio la cita a COMPLETED/CANCELLED entre el findUnique y aca, esta
    // no la reabre.
    const { count } = await prisma.appointment.updateMany({
      where: { id, status: { in: ["PENDING", "IN_PROGRESS"] } },
      data: { status: "IN_PROGRESS" },
    });

    if (count === 0) {
      res.status(409).json({ error: "La cita ya fue finalizada o cancelada" });
      return;
    }

    const updated = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        manicurist: { select: { id: true, name: true } },
        services: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error iniciando cita:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function completeAppointment(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params as { id?: string };

    if (!id) {
      res.status(400).json({ error: "El parametro 'id' es requerido" });
      return;
    }

    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Cita no encontrada" });
      return;
    }

    if (req.user?.role === "MANICURISTA" && existing.manicuristId !== req.user.userId) {
      res.status(403).json({ error: "No autorizado para completar una cita de otra manicurista" });
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
  req: AuthRequest,
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

    // Sin esto, cualquier manicurista autenticada podia mandar el id de OTRO
    // usuario (otra manicurista, un admin) en el body y sobreescribir su
    // nombre/edad/genero/avatar -- este endpoint es de autoedicion de perfil,
    // no de gestion (eso ya existe aparte en /admin/manicurists, con requireAdmin).
    if (req.user?.role === "MANICURISTA" && id !== req.user.userId) {
      res.status(403).json({ error: "No autorizado para editar el perfil de otro usuario" });
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
