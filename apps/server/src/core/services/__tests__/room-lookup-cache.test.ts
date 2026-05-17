import { describe, it, expect } from 'vitest'
import { RoomLookupCache } from '../room-lookup-cache'
import { buildCache, createFromTemplate } from '@iomtea/shared-types'

describe('RoomLookupCache', () => {
  it('enriches event with thingId when device is bound', () => {
    const { map, things } = createFromTemplate('studio')!
    things[0].deviceId = 'test-device-uuid'
    const runtime = buildCache(map, things)

    const cache = new RoomLookupCache()
    ;(cache as any).runtimeByPatient.set('patient-1', runtime)
    ;(cache as any).thingByDevice.set('test-device-uuid', things[0])

    const event = { deviceId: 'test-device-uuid', tags: {} as Record<string, unknown> }
    cache.enrich(event)
    expect(event.tags.thingId).toBe(things[0].id)
    expect(event.tags.thingType).toBe(things[0].thingType)
  })

  it('skips enrichment when device is not bound to any thing', () => {
    const cache = new RoomLookupCache()
    const event = { deviceId: 'unknown-device', tags: {} as Record<string, unknown> }
    cache.enrich(event)
    expect(event.tags.thingId).toBeUndefined()
  })
})
