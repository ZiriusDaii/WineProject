import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";

export async function loginStaff(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      res
        .status(400)
        .json({ error: "Los campos 'username' y 'password' son requeridos" });
      return;
    }

    if (username.length > 30 || password.length > 64) {
      res.status(400).json({ error: "Usuario o contraseña demasiado largos" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        password: true,
        name: true,
        phone: true,
        role: true,
        avatarPath: true,
        age: true,
        gender: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: "Credenciales inválidas" });
      return;
    }

    if (!user.password || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: "Credenciales inválidas" });
      return;
    }

    const { password: _, ...safeUser } = user;

    const token = signToken({ userId: user.id, role: user.role });

    res.json({ token, user: safeUser });
  } catch (error) {
    console.error("Error en loginStaff:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
