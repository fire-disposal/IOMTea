import Taro from '@tarojs/taro'
import { getUnsyncedRecords, markSynced } from './storage'

const SYNC_INTERVAL = 5 * 60 * 1000

export async function syncUnsyncedRecords(): Promise<void> {
  const unsynced = getUnsyncedRecords()
  if (unsynced.length === 0) return

  try {
    const result = await Taro.request({
      url: `/trpc/health-records.batchCreate`,
      method: 'POST',
      data: { records: unsynced },
    })

    if (result.data?.result?.data?.syncedIds) {
      markSynced(result.data.result.data.syncedIds)
    }
  } catch (err) {
    console.warn('[Sync] failed, will retry later:', err)
  }
}

export function startAutoSync(): void {
  syncUnsyncedRecords()
  setInterval(syncUnsyncedRecords, SYNC_INTERVAL)
}
