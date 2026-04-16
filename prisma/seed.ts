import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: { name: "admin" },
  });

  const djRole = await prisma.role.upsert({
    where: { name: "dj" },
    update: {},
    create: { name: "dj" },
  });

  await prisma.role.upsert({
    where: { name: "viewer" },
    update: {},
    create: { name: "viewer" },
  });

  // Create default admin user (password: admin123)
  const passwordHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
    },
  });

  // Assign admin role
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  // Create a demo DJ user (password: dj123)
  const djHash = await bcrypt.hash("dj123", 12);
  const dj = await prisma.user.upsert({
    where: { username: "dj" },
    update: {},
    create: {
      username: "dj",
      passwordHash: djHash,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: dj.id, roleId: djRole.id } },
    update: {},
    create: { userId: dj.id, roleId: djRole.id },
  });

  // Ensure PlayerState singleton row exists
  await prisma.playerState.upsert({
    where: { id: "current" },
    update: {},
    create: { id: "current" },
  });

  console.log("Seed complete: admin/admin123, dj/dj123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
