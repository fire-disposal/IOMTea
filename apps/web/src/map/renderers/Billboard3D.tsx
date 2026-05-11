import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Sprite2D } from '@iomtea/shared-types/map'

interface Billboard3DProps {
  sprite: Sprite2D
  tileSize: number
  layerY: number
  position: [number, number, number]
}

export function Billboard3D({ sprite, tileSize, layerY, position }: Billboard3DProps) {
  const groupRef = useRef<THREE.Group>(null)

  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    const size = 64
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, size, size)

    const cx = size / 2
    const cy = size / 2
    const s = size * 0.8

    ctx.fillStyle = sprite.color
    switch (sprite.shape) {
      case 'circle':
        ctx.beginPath(); ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2); ctx.fill()
        break
      case 'diamond':
        ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.4); ctx.lineTo(cx + s * 0.4, cy)
        ctx.lineTo(cx, cy + s * 0.4); ctx.lineTo(cx - s * 0.4, cy); ctx.fill()
        break
      case 'line':
        ctx.fillRect(cx - s * 0.06, cy - s * 0.35, s * 0.12, s * 0.7)
        break
      default:
        ctx.fillRect(cx - s * 0.35, cy - s * 0.35, s * 0.7, s * 0.7)
    }

    if (sprite.label) {
      ctx.fillStyle = sprite.labelColor || '#fff'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(sprite.label, cx, cy)
    }

    const tex = new THREE.CanvasTexture(c)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.NearestFilter
    return tex
  }, [sprite])

  useFrame(({ camera }) => {
    if (groupRef.current) {
      groupRef.current.lookAt(camera.position)
    }
  })

  return (
    <group ref={groupRef} position={[position[0], position[1] + layerY * 0.3, position[2]]}>
      <mesh>
        <planeGeometry args={[tileSize * 0.8, tileSize * 0.8]} />
        <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
