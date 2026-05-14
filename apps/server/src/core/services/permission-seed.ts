import type { DbClient } from '../db'
import { permissions, rolePermissions } from '../db'
import { eq, and } from 'drizzle-orm'

const DEFAULT_PERMISSIONS = [
  { code: 'patient:read', name: '查看患者', resource: 'patient', action: 'read' },
  { code: 'patient:write', name: '编辑患者', resource: 'patient', action: 'write' },
  { code: 'patient:delete', name: '删除患者', resource: 'patient', action: 'delete' },
  { code: 'device:read', name: '查看设备', resource: 'device', action: 'read' },
  { code: 'device:write', name: '编辑设备', resource: 'device', action: 'write' },
  { code: 'device:manage', name: '管理设备', resource: 'device', action: 'manage' },
  { code: 'alert:read', name: '查看告警', resource: 'alert', action: 'read' },
  { code: 'alert:manage', name: '管理告警', resource: 'alert', action: 'manage' },
  { code: 'medication:read', name: '查看用药', resource: 'medication', action: 'read' },
  { code: 'medication:write', name: '管理用药', resource: 'medication', action: 'write' },
  { code: 'appointment:read', name: '查看预约', resource: 'appointment', action: 'read' },
  { code: 'appointment:write', name: '管理预约', resource: 'appointment', action: 'write' },
  { code: 'dashboard:view', name: '查看仪表盘', resource: 'dashboard', action: 'view' },
  { code: 'twin:read', name: '查看孪生', resource: 'twin', action: 'read' },
  { code: 'twin:manage', name: '管理孪生', resource: 'twin', action: 'manage' },
  { code: 'admin:settings', name: '系统设置', resource: 'admin', action: 'settings' },
]

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  admin:       DEFAULT_PERMISSIONS.map((p) => p.code),
  doctor:      ['patient:read', 'patient:write', 'device:read', 'device:write', 'device:manage',
                 'alert:read', 'alert:manage', 'medication:read', 'medication:write',
                 'appointment:read', 'appointment:write', 'twin:read', 'twin:manage', 'dashboard:view'],
  nurse:       ['patient:read', 'device:read', 'alert:read', 'alert:manage',
                 'medication:read', 'appointment:read', 'twin:read', 'dashboard:view'],
  caregiver:   ['patient:read', 'alert:read', 'medication:read', 'twin:read', 'dashboard:view'],
  patient:     ['dashboard:view'],
  family:      ['dashboard:view'],
}

export async function seedPermissions(db: DbClient): Promise<void> {
  for (const perm of DEFAULT_PERMISSIONS) {
    const existing = await db.select().from(permissions).where(eq(permissions.code, perm.code)).limit(1)
    if (existing.length === 0) {
      await db.insert(permissions).values(perm)
    }
  }

  for (const [role, codes] of Object.entries(ROLE_PERMISSION_MAP)) {
    for (const code of codes) {
      const existing = await db
        .select()
        .from(rolePermissions)
        .where(and(eq(rolePermissions.role, role as any), eq(rolePermissions.permissionCode, code)))
        .limit(1)
      if (existing.length === 0) {
        await db.insert(rolePermissions).values({
          role: role as any,
          permissionCode: code,
        })
      }
    }
  }
}
