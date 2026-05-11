/// <reference types="@react-three/fiber" />
import { useMemo } from 'react'
import type { MapModel } from '@iomtea/shared-types/map'
import { getWallSegments, getEntityDef, getAsset } from '@iomtea/shared-types/map'
import { useEntityStateStore } from '../store/entityState'
import { ZoneFloor } from './renderers/ZoneFloor'
import { WallMesh } from './renderers/WallMesh'
import { Bed3D } from './renderers/Bed3D'
import { Person3D } from './renderers/Person3D'
import { DeviceMarker3D } from './renderers/DeviceMarker3D'
import { Billboard3D } from './renderers/Billboard3D'

interface MapRenderer3DProps {
  model: MapModel
  entityStatusMap?: Map<string, 'normal' | 'warning' | 'alert'>
  patientDataMap?: Map<string, {
    heartRate: number | null
    spO2: number | null
    systolicBP: number | null
    diastolicBP: number | null
  }>
}

const KNOWN_3D: Record<string, React.ComponentType<any>> = {
  'bed': Bed3D,
  'person': Person3D,
  'mattress_sensor': DeviceMarker3D,
  'emergency_btn': DeviceMarker3D,
}

export function MapRenderer3D({ model, entityStatusMap, patientDataMap }: MapRenderer3DProps) {
  const walls = useMemo(() => getWallSegments(model), [model])
  const entityStates = useEntityStateStore((s) => s.states)

  return (
    <group>
      <ambientLight intensity={0.4} />
      <directionalLight position={[15, 20, 10]} intensity={0.8} castShadow />

      {model.zones.map((zone) => (
        <ZoneFloor key={zone.id} zone={zone} tileSize={model.tileSize} />
      ))}

      {walls.map((seg, i) => (
        <WallMesh key={`wall-${i}`} segment={seg} />
      ))}

      {model.entities.map((ent) => {
        const def = getEntityDef(ent.defId)
        if (!def) return null
        const asset = getAsset(def.assetId)
        if (!asset) return null

        const es = entityStates?.get(ent.id)
        const pd = ent.patientId ? patientDataMap?.get(ent.patientId) : undefined
        const activeStatus = entityStatusMap?.get(ent.id) || ent.status

        const cx = (ent.gridX + def.pivot.x) * model.tileSize
        const cz = (ent.gridY + def.pivot.y) * model.tileSize
        const layerY = ent.layer === 2 ? 2.5 : ent.layer === 1 ? 0.5 : 0

        const overriddenEnt = activeStatus !== ent.status ? { ...ent, status: activeStatus } : ent

        const Component3D = KNOWN_3D[def.id]
        if (Component3D) {
          const C = Component3D
          return (
            <C
              key={ent.id}
              entity={overriddenEnt}
              def={def}
              tileSize={model.tileSize}
              entityState={es}
              patientData={pd}
            />
          )
        }

        return (
          <Billboard3D
            key={ent.id}
            sprite={asset.sprite2D}
            tileSize={model.tileSize}
            layerY={layerY}
            position={[cx, 0, cz]}
          />
        )
      })}
    </group>
  )
}
