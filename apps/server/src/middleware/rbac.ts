import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { db } from '../core/db'
import { rolePermissions } from '../core/db/schema/auth-ext'

const rolePermCache = new Map<string, Set<string>>()

async function loadPermissions(role: string): Promise<Set<string>> {
  if (rolePermCache.has(role)) return rolePermCache.get(role)!
  const rows = await db
    .select({ code: rolePermissions.permissionCode })
    .from(rolePermissions)
    .where(eq(rolePermissions.role, role as any))
  const set = new Set(rows.map((r) => r.code))
  rolePermCache.set(role, set)
  return set
}

export function requirePermission(...codes: string[]) {
  return createMiddleware(async (c, next) => {
    const role = c.get('userRole') as string | undefined
    if (!role) return c.json({ error: 'Forbidden' }, 403)
    if (role === 'super_admin') return await next()
    const perms = await loadPermissions(role)
    if (codes.every((code) => perms.has(code))) return await next()
    return c.json({ error: 'Forbidden', message: 'Insufficient permissions' }, 403)
  })
}
