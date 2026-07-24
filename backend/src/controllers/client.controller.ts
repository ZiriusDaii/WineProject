import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "../../prisma/generated/client.js";
import { getISOWeek } from "../lib/week.js";
import { signToken } from "../lib/jwt.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

export const isValidPhone = (phone: string) => /^\d{7,10}$/.test(phone);

// El "login" de cliente sigue siendo solo por telefono (sin password/OTP,
// decision consciente por ahora -- ver conversacion). Este token no prueba
// identidad real, pero evita que cualquiera que sepa/adivine un clientId o
// un appointmentId pueda leer o modificar citas ajenas sin haber pasado
// primero por el chequeo de telefono.
const signClientToken = (userId: string) => signToken({ userId, role: "CLIENTE" });

// MANICURISTA queda afuera a proposito: antes cualquier manicurista podia
// leer/crear/cancelar citas de CUALQUIER cliente via estos endpoints. Su
// acceso a citas de clientes debe pasar por /manicurist/appointments
// (getManicuristDashboard), que ya filtra por su propio manicuristId.
const isOwner = (req: AuthRequest, ownerId: string) =>
  !!req.user && (req.user.role === "ADMIN" || req.user.role === "OWNER" || req.user.userId === ownerId);

// Cuentas viejas pueden tener el numero guardado con prefijo de pais (57),
// un cero inicial u otros caracteres si se registraron antes de que el
// frontend limitara el input a 10 digitos limpios. Normalizamos a los
// ultimos 10 digitos para que un cliente antiguo pueda seguir encontrando
// su cuenta con el input actual.
export const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
};

// Busca por telefono normalizado. Con menos de 10 digitos, solo exacto (un
// input de 7 podria coincidir con el final de varios celulares distintos por
// sufijo, asi que ese modo esta descartado del todo). Con los 10 digitos
// completos de un celular colombiano, se buscan TODAS las cuentas que
// terminen en esos digitos -- exacta o con prefijo de pais viejo -- en una
// sola pasada: si hay una sola, esa es la cuenta; si hay mas de una (incluso
// si una de ellas matcheaba exacto), no hay forma segura de saber cual es la
// correcta y se trata como "no encontrado" en vez de preferir la exacta a
// ciegas y esconder que existe otra cuenta ambigua para el mismo numero.
async function findUserByPhone(
  phone: string,
  where: Record<string, unknown>,
  select?: Record<string, boolean>,
): Promise<any | null> {
  const normalized = normalizePhone(phone);

  if (normalized.length !== 10) {
    return prisma.user.findFirst({ where: { phone: normalized, ...where }, select });
  }

  const candidates = await prisma.user.findMany({
    where: { phone: { endsWith: normalized }, ...where },
    select,
  });
  return candidates.length === 1 ? candidates[0] : null;
}

// Para el chequeo de duplicados en el registro. findUserByPhone resuelve una
// identidad y por eso falla cerrado (null) ante un sufijo ambiguo -- correcto
// para login, donde no hay a que cuenta loguear si hay mas de una candidata.
// Pero para registro esa ambiguedad NO significa "numero libre": si hay 2+
// cuentas que terminan en los mismos 10 digitos, el numero ya esta tomado
// igual, y crear una cuenta nueva mas seria un tercer duplicado.
// excludeId: para actualizar un registro a su propio telefono ya normalizado
// sin que el chequeo se auto-rechace como "ya tomado".
export async function phoneIsTaken(phone: string, excludeId?: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  const notSelf = excludeId ? { id: { not: excludeId } } : {};
  if (await prisma.user.count({ where: { phone: normalized, ...notSelf } })) return true;
  if (normalized.length !== 10) return false;
  return (await prisma.user.count({ where: { phone: { endsWith: normalized }, ...notSelf } })) > 0;
}

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

// Si la manicurista tiene un turno asignado para la semana de `date`, la cita
// debe caer dentro de ese turno. Sin turno asignado no se restringe nada mas
// alla del horario del local (isWithinBusinessHours) -- evita bloquear el
// booking en negocios que todavia no cargaron turnos.
async function isWithinManicuristShift(
  manicuristId: string,
  date: Date,
  durationMinutes: number,
): Promise<boolean> {
  const { week, year } = getISOWeek(date);
  const schedule = await prisma.manicuristSchedule.findUnique({
    where: { manicuristId_weekNumber_year: { manicuristId, weekNumber: week, year } },
    include: { shiftTemplate: true },
  });
  if (!schedule) return true;
  const startMin = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (
    startMin >= timeToMinutes(schedule.shiftTemplate.startTime) &&
    startMin + durationMinutes <= timeToMinutes(schedule.shiftTemplate.endTime)
  );
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

export async function getServices(req: AuthRequest, res: Response): Promise<void> {
  try {
    // El panel de admin reusa este mismo endpoint publico para su propia
    // lista de servicios (para no duplicar el fetch) -- staff autenticado
    // necesita ver tambien los deshabilitados para poder reactivarlos, el
    // catalogo publico/booking no.
    const isStaffRequest = req.user?.role === "ADMIN" || req.user?.role === "OWNER" || req.user?.role === "MANICURISTA";
    const activeFilter = isStaffRequest ? {} : { isActive: true };

    const hasPagination = req.query.page || req.query.limit || req.query.search;

    if (!hasPagination) {
      const services = await prisma.service.findMany({
        where: activeFilter,
        select: {
          id: true,
          name: true,
          shortDescription: true,
          includesDescription: true,
          category: true,
          gender: true,
          imageUrl: true,
          price: true,
          durationInMinutes: true,
          trending: true,
          isActive: true,
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

    const where = {
      ...activeFilter,
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [data, totalCount] = await Promise.all([
      prisma.service.findMany({
        where,
        select: {
          id: true,
          name: true,
          shortDescription: true,
          includesDescription: true,
          category: true,
          gender: true,
          imageUrl: true,
          price: true,
          durationInMinutes: true,
          trending: true,
          isActive: true,
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
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const manicurists = await prisma.user.findMany({
      where: { role: "MANICURISTA", isActive: true },
      select: { id: true, name: true, avatarPath: true, age: true, gender: true },
    });

    // Si viene `date`, se adjunta el turno asignado esa semana (o null si no
    // tiene uno asignado -- se interpreta como "sin restriccion", no como
    // "no disponible", para no romper el booking en negocios sin turnos cargados).
    const date = req.query.date as string | undefined;
    if (!date) {
      res.json(manicurists);
      return;
    }

    const { week, year } = getISOWeek(new Date(`${date}T00:00:00.000Z`));
    const schedules = await prisma.manicuristSchedule.findMany({
      where: { weekNumber: week, year },
      include: { shiftTemplate: true },
    });
    const shiftByManicurist = new Map(
      schedules.map((s) => [s.manicuristId, { startTime: s.shiftTemplate.startTime, endTime: s.shiftTemplate.endTime }]),
    );

    res.json(
      manicurists.map((m) => ({ ...m, shift: shiftByManicurist.get(m.id) ?? null })),
    );
  } catch (error) {
    console.error("Error obteniendo manicuristas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function getOffers(_req: AuthRequest, res: Response): Promise<void> {
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
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { phone } = req.body as { phone?: string };

    if (!phone) {
      console.warn(`Input rechazado (authClient): campo=phone ip=${req.ip}`);
      res.status(400).json({ error: "El campo 'phone' es requerido" });
      return;
    }

    if (!isValidPhone(phone)) {
      console.warn(`Input rechazado (authClient): campo=phone (formato) ip=${req.ip}`);
      res.status(400).json({ error: "El campo 'phone' debe tener entre 7 y 10 digitos" });
      return;
    }

    // Solo cuentas de tipo CLIENTE: un telefono de staff (admin/manicurista)
    // no debe autenticar ni prellenar datos en el flujo de clientes.
    const user = await findUserByPhone(phone, { role: "CLIENTE" }, {
      id: true,
      name: true,
      phone: true,
      age: true,
      gender: true,
      role: true,
      createdAt: true,
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
      token: signClientToken(user.id),
    });
  } catch (error) {
    console.error("Error en authClient:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function createClient(
  req: AuthRequest,
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
      console.warn(`Input rechazado (createClient): campo=phone/name ip=${req.ip}`);
      res
        .status(400)
        .json({ error: "Los campos 'phone' y 'name' son requeridos" });
      return;
    }

    if (!isValidPhone(phone)) {
      console.warn(`Input rechazado (createClient): campo=phone (formato) ip=${req.ip}`);
      res.status(400).json({ error: "El campo 'phone' debe tener entre 7 y 10 digitos" });
      return;
    }

    if (name.length > 60) {
      console.warn(`Input rechazado (createClient): campo=name (longitud) ip=${req.ip}`);
      res.status(400).json({ error: "El campo 'name' es demasiado largo" });
      return;
    }

    if (age != null && (age < 0 || age > 100)) {
      console.warn(`Input rechazado (createClient): campo=age (rango) ip=${req.ip}`);
      res.status(400).json({ error: "El campo 'age' esta fuera de rango" });
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    const existing = await findUserByPhone(phone, {}, { id: true });
    if (existing) {
      res.status(409).json({ error: "Ya existe una cuenta con ese numero de telefono", clientId: existing.id });
      return;
    }
    if (await phoneIsTaken(phone)) {
      // Sufijo ambiguo (2+ cuentas terminan en los mismos 10 digitos): no hay
      // una identidad segura a la que recuperar la sesion, pero el numero
      // igual esta tomado -- se bloquea el registro sin devolver clientId.
      res.status(409).json({ error: "Ya existe una cuenta con ese numero de telefono" });
      return;
    }

    const client = await prisma.user.create({
      data: {
        phone: normalizedPhone,
        name,
        age: age ?? null,
        gender: gender ?? null,
        role: "CLIENTE",
      },
      select: { id: true, name: true, phone: true, age: true, gender: true },
    });

    res.status(201).json({ ...client, token: signClientToken(client.id) });
  } catch (error) {
    // El chequeo de "ya existe" de arriba es raceable: dos requests casi
    // simultaneas pueden pasar ambas el preflight antes de que cualquiera
    // inserte, y la segunda insercion choca contra users_phone_key. Sin esto
    // llegaba al 500 generico en vez del mismo 409 que el chequeo normal.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "Ya existe una cuenta con ese numero de telefono" });
      return;
    }
    console.error("Error creando cliente:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function createAppointment(
  req: AuthRequest,
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
      console.warn(`Input rechazado (createAppointment): campo=${missing.join("/")} ip=${req.ip}`);
      res.status(400).json({
        error: `Faltan campos requeridos: ${missing.join(", ")}`,
        missing,
      });
      return;
    }

    if (!isOwner(req, clientId!)) {
      res.status(req.user ? 403 : 401).json({ error: "No autorizado para crear una cita a nombre de otro cliente" });
      return;
    }

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds! } },
    });

    if (services.length !== serviceIds!.length) {
      console.warn(`Input rechazado (createAppointment): campo=serviceIds (inexistentes) ip=${req.ip}`);
      res.status(400).json({ error: "Uno o más serviceIds no existen" });
      return;
    }

    const totalDuration = services.reduce(
      (sum, s) => sum + s.durationInMinutes,
      0,
    );
    const totalPrice = services.reduce((sum, s) => sum + Number(s.price), 0);
    const parsedDate = new Date(date!);

    if (Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() < Date.now()) {
      console.warn(`Input rechazado (createAppointment): campo=date (pasada/invalida) ip=${req.ip}`);
      res.status(400).json({ error: "No es posible agendar una cita en una fecha u hora pasada" });
      return;
    }

    if (!isWithinBusinessHours(parsedDate, totalDuration)) {
      console.warn(`Input rechazado (createAppointment): campo=date (fuera de horario del local) ip=${req.ip}`);
      res.status(400).json({ error: "El horario elegido esta fuera del horario del local" });
      return;
    }

    if (!(await isWithinManicuristShift(manicuristId!, parsedDate, totalDuration))) {
      console.warn(`Input rechazado (createAppointment): campo=date (fuera del turno) ip=${req.ip}`);
      res.status(400).json({ error: "El horario elegido esta fuera del turno de la manicurista" });
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
        console.warn(`Input rechazado (createAppointment): campo=serviceIds (categoria duplicada) ip=${req.ip}`);
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
  req: AuthRequest,
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

    if (!isOwner(req, existing.clientId)) {
      res.status(req.user ? 403 : 401).json({ error: "No autorizado para modificar esta cita" });
      return;
    }

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (manicuristId) data.manicuristId = manicuristId;

    if (date || manicuristId) {
      const targetDate = date ? new Date(date) : existing.date;
      const targetManicuristId = manicuristId ?? existing.manicuristId;

      if (date && (Number.isNaN(targetDate.getTime()) || targetDate.getTime() < Date.now())) {
        res.status(400).json({ error: "No es posible reprogramar una cita a una fecha u hora pasada" });
        return;
      }

      if (!isWithinBusinessHours(targetDate, existing.totalDuration)) {
        res.status(400).json({ error: "El horario elegido esta fuera del horario del local" });
        return;
      }

      if (!(await isWithinManicuristShift(targetManicuristId, targetDate, existing.totalDuration))) {
        res.status(400).json({ error: "El horario elegido esta fuera del turno de la manicurista" });
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
  req: AuthRequest,
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

    if (!isOwner(req, clientId)) {
      res.status(req.user ? 403 : 401).json({ error: "No autorizado para ver estas citas" });
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
  req: AuthRequest,
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
  req: AuthRequest,
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
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { code, phone } = req.body as { code?: string; phone?: string };

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

    const now = new Date();
    if (offer.validFrom && now < offer.validFrom) {
      res.status(400).json({ error: "Esta oferta aún no está vigente" });
      return;
    }
    if (offer.validUntil && now > offer.validUntil) {
      res.status(400).json({ error: "Esta oferta ha expirado" });
      return;
    }

    if (offer.newUsersOnly) {
      if (!phone) {
        res.status(400).json({ error: "Este código es solo para nuevos clientes. Inicia sesión para validarlo." });
        return;
      }
      const user = await prisma.user.findUnique({ where: { phone } });
      if (user) {
        const priorAppointments = await prisma.appointment.count({
          where: { clientId: user.id, status: { not: "CANCELLED" } },
        });
        if (priorAppointments > 0) {
          res.status(400).json({ error: "Este código es exclusivo para nuevos clientes (sin citas previas)" });
          return;
        }
      }
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
