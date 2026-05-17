import { useMemo, useRef, useState, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import type { TileFlag } from '@iomtea/shared-types'
import * as THREE from 'three'

const FLOOR_MAT = new THREE.MeshStandardMaterial({ color: '#f0ebe0', roughness: 0.9 })
const VOID_MAT = new THREE.MeshStandardMaterial({ color: '#4a4540', roughness: 0.95 })
const WALL_MAT = new THREE.MeshStandardMaterial({ color: '#d4c8b8', roughness: 0.85 })
const WALL_HOVER_MAT = new THREE.MeshStandardMaterial({ color: '#e8dcc8', roughness: 0.85 })
const DOOR_MAT = new THREE.MeshStandardMaterial({ color: '#9b8565', roughness: 0.8 })
const WALL_H = 2.2
const DOOR_H = 0.15

interface TileMap3DProps {
  grid: TileFlag[][]
  hoverTile?: { x: number; z: number } | null
  selectedTiles?: { x: number; z: number }[]
  onClick?: (x: number, z: number) => void
  onHover?: (x: number, z: number) => void
  interactive?: boolean
}

export function TileMap3D({ grid, hoverTile, selectedTiles, onClick, onHover, interactive = false }: TileMap3DProps) {
  const h = grid.length
  const w = h > 0 ? grid[0].length : 0
  const cx = w / 2 - 0.5
  const cz = h / 2 - 0.5

  const tiles = useMemo(() => {
    const result: { x: number; z: number; tile: number }[] = []
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        result.push({ x, z, tile: grid[z][x] })
      }
    }
    return result
  }, [grid, w, h])

  const selSet = useMemo(() => {
    if (!selectedTiles) return null
    return new Set(selectedTiles.map((t) => `${t.x},${t.z}`))
  }, [selectedTiles])

  return (
    <group>
      {tiles.map(({ x, z, tile }) => {
        const ox = x - cx
        const oz = z - cz
        const key = `${x},${z}`
        const isHovered = hoverTile?.x === x && hoverTile?.z === z
        const isSelected = selSet?.has(key)

        if (tile === 0) {
          return (
            <mesh key={key} position={[ox, -0.01, oz]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1, 1]} />
              <primitive object={VOID_MAT} attach="material" />
            </mesh>
          )
        }

        return (
          <group key={key}>
            <mesh
              position={[ox, -0.005, oz]}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={interactive ? (e) => { e.stopPropagation(); onClick?.(x, z) } : undefined}
              onPointerEnter={interactive ? () => onHover?.(x, z) : undefined}
              onPointerLeave={interactive ? () => onHover?.(-1, -1) : undefined}
            >
              <planeGeometry args={[1, 1]} />
              <primitive object={FLOOR_MAT} attach="material" />
              {isHovered && (
                <mesh position={[0, 0.01, 0]}>
                  <planeGeometry args={[1, 1]} />
                  <meshBasicMaterial color="#ffd700" transparent opacity={0.3} />
                </mesh>
              )}
            </mesh>

            {tile === 2 && (
              <mesh position={[ox, WALL_H / 2, oz]} castShadow receiveShadow>
                <boxGeometry args={[0.94, WALL_H, 0.94]} />
                <primitive object={isHovered ? WALL_HOVER_MAT : WALL_MAT} attach="material" />
              </mesh>
            )}

            {tile === 3 && (
              <mesh position={[ox, DOOR_H / 2, oz]} castShadow>
                <boxGeometry args={[0.94, DOOR_H, 0.2]} />
                <primitive object={DOOR_MAT} attach="material" />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}