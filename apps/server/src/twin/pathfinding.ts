interface GridCell {
  terrain: 0 | 1 | 2  // 0=void, 1=floor, 2=door
}

interface Point {
  x: number
  y: number
}

interface PathNode {
  x: number
  y: number
  g: number
  h: number
  f: number
  parent: PathNode | null
}

function heuristic(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function key(x: number, y: number): string {
  return `${x},${y}`
}

function isPassable(grid: GridCell[][], x: number, y: number): boolean {
  if (y < 0 || y >= grid.length || x < 0 || x >= (grid[0]?.length ?? 0)) return false
  const cell = grid[y][x]
  return cell.terrain === 1 || cell.terrain === 2  // floor and door are passable
}

function getNeighbors(grid: GridCell[][], node: PathNode): Point[] {
  const dirs = [
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
  ]
  const results: Point[] = []
  for (const { dx, dy } of dirs) {
    const nx = node.x + dx
    const ny = node.y + dy
    if (isPassable(grid, nx, ny)) {
      results.push({ x: nx, y: ny })
    }
  }
  return results
}

export interface PathResult {
  path: Point[]
  cost: number
  explored: number
}

export function findPath(
  grid: GridCell[][],
  from: Point,
  to: Point,
  opts?: { maxIterations?: number },
): PathResult | null {
  const maxIter = opts?.maxIterations ?? 10000
  const open: PathNode[] = [{ x: from.x, y: from.y, g: 0, h: heuristic(from, to), f: heuristic(from, to), parent: null }]
  const closed = new Set<string>()
  let explored = 0

  while (open.length > 0 && explored < maxIter) {
    explored++
    open.sort((a, b) => b.f - a.f)
    const current = open.pop()!

    if (current.x === to.x && current.y === to.y) {
      const path: Point[] = []
      let node: PathNode | null = current
      while (node) {
        path.unshift({ x: node.x, y: node.y })
        node = node.parent
      }
      return { path, cost: current.g, explored }
    }

    closed.add(key(current.x, current.y))

    for (const neighbor of getNeighbors(grid, current)) {
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

export function isValidPath(path: Point[], grid: GridCell[][]): boolean {
  return path.every((p) => isPassable(grid, p.x, p.y))
}
