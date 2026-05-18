import { describe, it, expect, beforeEach } from 'vitest'
import { twinState } from './twin-state'

beforeEach(() => {
  twinState.initRooms([
    { id: 'living-room', name: 'Living Room' },
    { id: 'bedroom', name: 'Bedroom' },
    { id: 'bathroom', name: 'Bathroom' },
    { id: 'kitchen', name: 'Kitchen' },
    { id: 'hallway', name: 'Hallway' },
  ], [
    { id: 'living-room', connections: ['kitchen', 'hallway'], hasCamera: false },
    { id: 'bedroom', connections: ['bathroom', 'hallway'], hasCamera: true },
    { id: 'bathroom', connections: ['bedroom'], hasCamera: false },
    { id: 'kitchen', connections: ['living-room', 'hallway'], hasCamera: true },
    { id: 'hallway', connections: ['living-room', 'bedroom', 'kitchen'], hasCamera: false },
  ])
})

describe('initRooms', () => {
  it('creates rooms with correct names', () => {
    const rooms = twinState.getAllRooms()
    expect(rooms).toHaveLength(5)
    const names = rooms.map((r) => r.roomName).sort()
    expect(names).toEqual(['Bathroom', 'Bedroom', 'Hallway', 'Kitchen', 'Living Room'])
  })

  it('sets hasCamera correctly from room details', () => {
    const bedroom = twinState.getRoom('bedroom')
    const hallway = twinState.getRoom('hallway')
    expect(bedroom?.hasCamera).toBe(true)
    expect(hallway?.hasCamera).toBe(false)
  })

  it('initializes all rooms as not occupied', () => {
    for (const room of twinState.getAllRooms()) {
      expect(room.personPresent).toBe(false)
    }
  })
})

describe('reportPresence', () => {
  it('reports enter event on first presence', () => {
    const result = twinState.reportPresence('living-room', true)
    expect(result.changed).toBe(true)
    expect(result.event).toBe('enter')
    const room = twinState.getRoom('living-room')
    expect(room?.personPresent).toBe(true)
    expect(room?.lastSeenAt).toBeGreaterThan(0)
  })

  it('reports exit event when person leaves', () => {
    twinState.reportPresence('living-room', true)
    const result = twinState.reportPresence('living-room', false)
    expect(result.changed).toBe(true)
    expect(result.event).toBe('exit')
    expect(result.fromRoom).toBe('living-room')
    const room = twinState.getRoom('living-room')
    expect(room?.personPresent).toBe(false)
  })

  it('does not report change on duplicate enter', () => {
    twinState.reportPresence('kitchen', true)
    const result = twinState.reportPresence('kitchen', true)
    expect(result.changed).toBe(false)
  })

  it('tracks device pins', () => {
    twinState.reportPresence('bedroom', true, 'pin-001')
    twinState.reportPresence('bedroom', true, 'pin-002')
    const room = twinState.getRoom('bedroom')
    expect(room?.devicePins).toContain('pin-001')
    expect(room?.devicePins).toContain('pin-002')
    expect(room?.deviceCount).toBe(2)
  })

  it('records fromRoom and path when moving between rooms', () => {
    twinState.reportPresence('living-room', true)
    const result = twinState.reportPresence('kitchen', true)
    expect(result.event).toBe('enter')
    expect(result.fromRoom).toBe('living-room')
    expect(result.path).toBeDefined()
    expect(result.path).toContain('kitchen')
  })

  it('clears presence from other rooms on enter', () => {
    twinState.reportPresence('living-room', true)
    twinState.reportPresence('bedroom', true)
    const livingRoom = twinState.getRoom('living-room')
    expect(livingRoom?.personPresent).toBe(false)
  })
})

describe('getCoverageAnalysis', () => {
  it('classifies rooms with cameras as covered', () => {
    const analysis = twinState.getCoverageAnalysis()
    expect(analysis.covered).toContain('bedroom')
    expect(analysis.covered).toContain('kitchen')
  })

  it('classifies rooms with all camera-neighbors as inferrable', () => {
    const analysis = twinState.getCoverageAnalysis()
    // bathroom only connects to bedroom (hasCamera=true) => inferrable
    expect(analysis.inferrable).toContain('bathroom')
  })

  it('classifies rooms with no camera and non-camera neighbors as blind', () => {
    const analysis = twinState.getCoverageAnalysis()
    // living-room connects to kitchen (camera) and hallway (no camera) => not all camera => blind
    // hallway connects to living-room (no camera), bedroom (camera), kitchen (camera) => not all => blind
    expect(analysis.blind).toContain('living-room')
    expect(analysis.blind).toContain('hallway')
  })
})

describe('getCurrentLocation', () => {
  it('returns current room after presence report', () => {
    twinState.reportPresence('kitchen', true)
    expect(twinState.getCurrentLocation()).toBe('kitchen')
  })

  it('updates when moving to a new room', () => {
    twinState.reportPresence('living-room', true)
    twinState.reportPresence('bedroom', true)
    expect(twinState.getCurrentLocation()).toBe('bedroom')
  })

  it('does not change on exit', () => {
    twinState.reportPresence('kitchen', true)
    twinState.reportPresence('kitchen', false)
    expect(twinState.getCurrentLocation()).toBe('kitchen')
  })
})
