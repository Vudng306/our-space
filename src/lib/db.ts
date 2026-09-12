import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { env } from "./env";

/**
 * A single client per process. Next.js hot-reloads modules in development, so
 * the instance is parked on globalThis to avoid exhausting the connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.isProduction ? ["error"] : ["error", "warn"],
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!env.isProduction) globalForPrisma.prisma = db;
