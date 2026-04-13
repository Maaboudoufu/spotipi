import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";
import { prisma } from "../../db/client";
import { config } from "../../config";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, ipAddress?: string, userAgent?: string) {
  const expiresAt = new Date(Date.now() + config.sessionMaxAge);
  return prisma.session.create({
    data: { id: uuid(), userId, expiresAt, ipAddress, userAgent },
  });
}

export async function getValidSession(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: { userRoles: { include: { role: true } } },
      },
    },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;
  return session;
}

export async function revokeSession(sessionId: string) {
  return prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}
