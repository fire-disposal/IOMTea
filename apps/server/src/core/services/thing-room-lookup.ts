import { db } from '../db'
import { homeThings, homeMaps } from '../db/schema/home-map'
import { eq } from 'drizzle-orm'
import { unpackGrid, detectRooms, buildTileRoomMap } from '@iomtea/shared-types'

const cache = new Map<string, { roomId: string; roomType: string }>()
let lastRefresh = 0
const REFRESH_INTERVAL = 60_000

export async function getThingRoom(thingId: string): Promise<{ roomId: string; roomType: string } | null> {
  const cached = cache.get(thingId)
  if (cached) return cached

  await refreshCacheForThing(thingId)
  return cache.get(thingId) ?? null
}

async function refreshCacheForThing(thingId: string): Promise<void> {
  const [thing] = await db.select().from(homeThings).where(eq(homeThings.id, thingId)).limit(1)
  if (!thing) return

  const [map] = await db.select().from(homeMaps).where(eq(homeMaps.id, thing.mapId)).limit(1)
  if (!map) return

  const grid = unpackGrid(map.packedGrid)
  const { rooms } = detectRooms(grid)
  const tileRoom = buildTileRoomMap(rooms)

  const roomId = tileRoom.get(`${thing.tileX},${thing.tileY}`)
  if (!roomId) return

  const room = rooms.find(r => r.id === roomId)
  cache.set(thingId, { roomId, roomType: room?.type ?? 'unknown' })
}

export function clearThingRoomCache(): void {
  cache.clear()
  lastRefresh = 0
}
