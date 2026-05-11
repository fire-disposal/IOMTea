import type { MapModel } from './types'
import { isWalkable } from './grid'

export interface PathResult {
  path: { x: number; y: number }[]
  cost: number
  explored: number
}

interface AStarNode {
  x: number
  y: number
  g: number
  h: number
  f: number
  parent?: AStarNode
}

function heuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function key(x: number, y: number): string {
  return `${x},${y}`
}

function getNeighbors(model: MapModel, node: AStarNode): { x: number; y: number }[] {
  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]
  const results: { x: number; y: number }[] = []
  for (const { dx, dy } of dirs) {
    const nx = node.x + dx
    const ny = node.y + dy
    if (nx >= 0 && nx < model.width && ny >= 0 && ny < model.height && isWalkable(model, nx, ny)) {
      results.push({ x: nx, y: ny })
    }
  }
  return results
}

export function findPath(
  model: MapModel,
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts?: { maxIterations?: number },
): PathResult | null {
  const maxIter = opts?.maxIterations ?? 10000
  const open: AStarNode[] = [{ x: from.x, y: from.y, g: 0, h: heuristic(from, to), f: heuristic(from, to) }]
  const closed = new Set<string>()
  let explored = 0

  while (open.length > 0 && explored < maxIter) {
    explored++
    open.sort((a, b) => b.f - a.f)
    const current = open.pop()!

    if (current.x === to.x && current.y === to.y) {
      const path: { x: number; y: number }[] = []
      let node: AStarNode | undefined = current
      while (node) {
        path.unshift({ x: node.x, y: node.y })
        node = node.parent
      }
      return { path, cost: current.g, explored }
    }

    closed.add(key(current.x, current.y))

    for (const neighbor of getNeighbors(model, current)) {
      if (closed.has(key(neighbor.x, neighbor.y))) continue
      const g = current.g + 1
      const h = heuristic(neighbor, to)
      const existing = open.find((n) => n.x === neighbor.x && n.y === neighbor.y)
      if (existing) {
        if (g < existing.g) {
          existing.g = g
          existing.f = g + existing.h
          existing.parent = current
        }
      } else {
        open.push({ x: neighbor.x, y: neighbor.y, g, h, f: g + h, parent: current })
      }
    }
  }

  return null
}
