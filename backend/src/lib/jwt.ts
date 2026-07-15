import jwt from "jsonwebtoken";

import crypto from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production"
  ? (() => { throw new Error("CRITICAL SECURITY ERROR: JWT_SECRET environment variable must be defined in production!"); })()
  : (() => {
      console.warn("WARNING: JWT_SECRET environment variable is not defined. Generating a random key for development session...");
      return crypto.randomBytes(32).toString("hex");
    })()
);
const JWT_EXPIRES_IN = "24h";

export interface JwtPayload {
  userId: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
