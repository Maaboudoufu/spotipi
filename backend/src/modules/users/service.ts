import { prisma } from "../../db/client";
import { hashPassword } from "../auth/service";

export async function createUser(username: string, password: string, roleNames: string[] = ["viewer"]) {
  const passwordHash = await hashPassword(password);

  const roles = await prisma.role.findMany({
    where: { name: { in: roleNames } },
  });

  return prisma.user.create({
    data: {
      username,
      passwordHash,
      userRoles: {
        create: roles.map((r) => ({ roleId: r.id })),
      },
    },
    include: { userRoles: { include: { role: true } } },
  });
}

export async function listUsers() {
  return prisma.user.findMany({
    include: { userRoles: { include: { role: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateUser(id: string, data: { username?: string; isActive?: boolean }) {
  return prisma.user.update({
    where: { id },
    data,
    include: { userRoles: { include: { role: true } } },
  });
}

export async function setUserRoles(userId: string, roleNames: string[]) {
  const roles = await prisma.role.findMany({
    where: { name: { in: roleNames } },
  });

  await prisma.userRole.deleteMany({ where: { userId } });
  await prisma.userRole.createMany({
    data: roles.map((r) => ({ userId, roleId: r.id })),
  });

  return prisma.user.findUnique({
    where: { id: userId },
    include: { userRoles: { include: { role: true } } },
  });
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}
