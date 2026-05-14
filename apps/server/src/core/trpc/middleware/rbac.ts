import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { permissions, rolePermissions } from '../../db'
import { middleware, publicProcedure } from '../init'
import { authMiddleware } from './auth'

const roleCache = new Map<string, string[]>()

async function getRolePermissions(db: any, role: string): Promise<string[]> {
  if (roleCache.has(role)) {
    return roleCache.get(role)!
  }

  const rows = await db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionCode, permissions.code))
    .where(eq(rolePermissions.role, role as any))

  const codes = rows.map((r: { code: string }) => r.code)
  roleCache.set(role, codes)
  return codes
}

export function clearPermissionCache() {
  roleCache.clear()
}

export function requirePermission(...codes: string[]) {
  return authMiddleware.unstable_pipe(
    middleware(async ({ ctx, next }) => {
      const userRole = ctx.userRole
      if (!userRole) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No role assigned' })
      }

      const allowed = await getRolePermissions(ctx.db, userRole)

      const hasAny = codes.some((code) => allowed.includes(code))
      if (!hasAny) {
        throw new TRPCError({ code: 'FORBIDDEN', message: `Missing required permission: ${codes.join(', ')}` })
      }

      return next()
    }),
  )
}

export const adminProcedure = publicProcedure.use(authMiddleware).use(
  middleware(async ({ ctx, next }) => {
    if (ctx.userRole !== 'admin') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required' })
    }
    return next()
  }),
)
