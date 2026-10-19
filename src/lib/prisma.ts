// SPDX-License-Identifier: MIT

import { PrismaClient, Prisma } from "@prisma/client";

export { Prisma };

const prismaClientSingleton = () => {
  return new PrismaClient();
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export interface KeysetCursorOptions {
  cursor?: string | null;
  limit?: number;
  order?: "asc" | "desc";
}

/**
 * Build Prisma findMany arguments for indexed keyset cursor pagination.
 * Takes limit + 1 to detect whether subsequent pages exist without an extra COUNT.
 */
export function buildPrismaCursorArgs(options: KeysetCursorOptions = {}) {
  const limit = options.limit ?? 20;
  const order = options.order === "asc" ? "asc" : "desc";
  return {
    take: limit + 1,
    orderBy: [
      { createdAt: order },
      { id: order },
    ] as [{ createdAt: typeof order }, { id: typeof order }],
    ...(options.cursor
      ? {
          cursor: { id: options.cursor },
          skip: 1,
        }
      : {}),
  };
}

