import { PrismaClient } from "@prisma/client";
export const db = new PrismaClient();
export const publicUser = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
} as const;
