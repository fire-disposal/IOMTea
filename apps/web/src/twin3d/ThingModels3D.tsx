import { useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import type { Thing, TileFlag } from '@iomtea/shared-types'
import type { Mesh } from 'three'

const THING_COLORS: Record<string, string> = {
  bed: '#8B6914', sofa: '#5D4E37', chair: '#6B4226', table: '#8B6914',
  toilet: '#E8E8E8', shower: '#B0C4DE', sink: '#E8E8E8',
  fridge: '#C0C0C0', stove: '#4A4A4A', tv: '#2A2A2A', cabinet: '#8B7355',
  desk: '#6B4226', wardrobe: '#8B7355', light: '#FFD700',
}

interface ThingModels3DProps {
  things: Thing[]
  gridW: number
  gridH: number
  onClick?: (thingId: string) => void
}

export function ThingModels3D({ things, gridW, gridH, onClick }: ThingModels3DProps) {
  const cx = gridW / 2 - 0.5
  const cz = gridH / 2 - 0.5

  return (
    <group>
      {things.map((thing) => {
        const ox = thing.tileX - cx
        const oz = thing.tileY - cz
        const color = THING_COLORS[thing.thingType] || '#888888'
        const w = thing.tileW * 0.9
        const d = thing.tileH * 0.9
        const h = thing.thingType === 'wardrobe' || thing.thingType === 'cabinet' ? 2.0
          : thing.thingType === 'fridge' ? 1.6
          : thing.thingType === 'bed' || thing.thingType === 'sofa' ? 0.6
          : 0.4

        return (
          <group key={thing.id} position={[ox + (thing.tileW - 1) * 0.5, h / 2, oz + (thing.tileH - 1) * 0.5]}>
            <mesh
              castShadow
              onClick={(e) => { e.stopPropagation(); onClick?.(thing.id) }}
            >
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <Html position={[0, h + 0.2, 0]} center style={{ pointerEvents: 'none' }}>
              <span style={{ fontSize: '10px', color: '#333', background: 'rgba(255,255,255,0.8)', padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                {thing.thingType}
              </span>
            </Html>
          </group>
        )
      })}
    </group>
  )
}