import { getUnsyncedRecords, markSynced } from './storage'
import { trpc } from './trpc'

const SYNC_INTERVAL = 5 * 60 * 1000

export async function syncUnsyncedRecords(): Promise<void> {
  const unsynced = getUnsyncedRecords()
  if (unsynced.length === 0) return

  try {
    const result = await trpc.healthRecords.batchCreate.mutate({ records: unsynced })
    if (result?.syncedIds) {
      markSynced(result.syncedIds)
    }
  } catch (err) {
    console.warn('[Sync] failed, will retry later:', err)
  }
}

export function startAutoSync(): void {
  syncUnsyncedRecords()
  setInterval(syncUnsyncedRecords, SYNC_INTERVAL)
}
