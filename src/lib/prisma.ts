import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

/**
 * Prisma Client Instantiation
 *
 * This file handles the creation of a singleton Prisma Client instance.
 *
 * Why Singleton?
 * In development, Next.js's "fast refresh" can re-import files, potentially creating multiple
 * database connections. This can lead to connection limit errors.
 * Storing the client in `globalThis` ensures we reuse the same instance across reloads.
 *
 * Why Driver Adapter?
 * We are using `better-sqlite3` as a driver adapter for Prisma to support serverless/edge environments
 * more efficiently and because it's a synchronous, faster SQLite driver for Node.js.
 */

const prismaClientSingleton = () => {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  })
  return new PrismaClient({ adapter })
}

// Declare global type to prevent TypeScript errors on globalThis.prisma
declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

// Use existing instance if available, otherwise create a new one
const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

// In development, save the instance to globalThis to persist across hot reloads
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
