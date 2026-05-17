import { TileFlag } from './types'

export function createEmptyGrid(w: number, h: number): TileFlag[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => TileFlag.VOID))
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function decodeBase64(packed: string): Uint8Array {
  const binary = atob(packed)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function packGrid(flags: TileFlag[][]): string {
  const h = flags.length
  const w = h > 0 ? flags[0].length : 0
  const totalBits = w * h * 2
  const dataBytes = Math.ceil(totalBits / 8)
  const buf = new Uint8Array(2 + dataBytes)
  buf[0] = w
  buf[1] = h

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const bitIndex = (row * w + col) * 2
      const byteIndex = 2 + Math.floor(bitIndex / 8)
      const bitOffset = bitIndex % 8
      buf[byteIndex] |= (flags[row][col] & 0b11) << bitOffset
    }
  }

  return encodeBase64(buf)
}

export function unpackGrid(packed: string): TileFlag[][] {
  const bytes = decodeBase64(packed)
  const w = bytes[0]
  const h = bytes[1]

  const grid: TileFlag[][] = []
  for (let row = 0; row < h; row++) {
    const rowArr: TileFlag[] = []
    for (let col = 0; col < w; col++) {
      const bitIndex = (row * w + col) * 2
      const byteIndex = 2 + Math.floor(bitIndex / 8)
      const bitOffset = bitIndex % 8
      const val = (bytes[byteIndex] >> bitOffset) & 0b11
      rowArr.push(val as TileFlag)
    }
    grid.push(rowArr)
  }

  return grid
}

export function isWalkable(flags: TileFlag[][], x: number, y: number): boolean {
  if (y < 0 || y >= flags.length) return false
  if (x < 0 || x >= flags[0].length) return false
  const tile = flags[y][x]
  return tile === TileFlag.FLOOR || tile === TileFlag.DOOR
}

export function placeTile(flags: TileFlag[][], x: number, y: number, flag: TileFlag): TileFlag[][] {
  if (y < 0 || y >= flags.length) return flags
  if (x < 0 || x >= flags[0].length) return flags
  if (flags[y][x] === flag) return flags
  return flags.map((row, ri) =>
    ri === y ? row.map((cell, ci) => (ci === x ? flag : cell)) : [...row],
  )
}
