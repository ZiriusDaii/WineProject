import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";

export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de autenticacion requerido" });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = verifyToken(token);
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "Token invalido o expirado" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== "ADMIN" && req.user?.role !== "OWNER") {
      res.status(403).json({ error: "Acceso restringido a administradores" });
      return;
    }
    next();
  });
}

export function requireStaff(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || !["ADMIN", "OWNER", "MANICURISTA"].includes(req.user.role)) {
      res.status(403).json({ error: "Acceso restringido a personal autorizado" });
      return;
    }
    next();
  });
}
