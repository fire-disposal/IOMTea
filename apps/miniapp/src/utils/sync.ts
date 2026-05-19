import { getUnsyncedRecords, markSynced } from './storage'
import { trpc } from './trpc'

const SYNC_INTERVAL = 5 * 60 * 1000

export interface SyncResult {
  syncedIds: string[]
  earnedCredits?: Array<{ moduleKey: string; amount: number; streakDay: number }>
}

export async function syncUnsyncedRecords(): Promise<SyncResult | null> {
  const unsynced = getUnsyncedRecords()
  if (unsynced.length === 0) return null

  try {
    const result = await trpc.healthRecords.batchCreate.mutate({ records: unsynced })
    if (result?.syncedIds) {
      markSynced(result.syncedIds)
    }
    return {
      syncedIds: result?.syncedIds ?? [],
      earnedCredits: result?.earnedCredits,
    }
  } catch (err) {
    console.warn('[Sync] failed, will retry later:', err)
    return null
  }
}

export function startAutoSync(onSyncResult?: (result: SyncResult) => void): void {
  syncUnsyncedRecords().then((r) => { if (r) onSyncResult?.(r) })
  setInterval(() => {
    syncUnsyncedRecords().then((r) => { if (r) onSyncResult?.(r) })
  }, SYNC_INTERVAL)
}
