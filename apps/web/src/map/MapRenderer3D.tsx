import { useMemo } from 'react'
import type { MapModel, EntityRuntime } from '@iomtea/shared-types/map'
import { getWallSegments, getEntityDef } from '@iomtea/shared-types/map'
import { ZoneFloor } from './renderers/ZoneFloor'
import { WallMesh } from './renderers/WallMesh'
import { Bed3D } from './renderers/Bed3D'
import { Person3D } from './renderers/Person3D'
import { DeviceMarker3D } from './renderers/DeviceMarker3D'

interface MapRenderer3DProps {
  model: MapModel
  runtimes?: Map<string, EntityRuntime>
  patientDataMap?: Map<string, {
    heartRate: number | null
    spO2: number | null
    systolicBP: number | null
    diastolicBP: number | null
  }>
}

export function MapRenderer3D({ model, runtimes, patientDataMap }: MapRenderer3DProps) {
  const walls = useMemo(() => getWallSegments(model), [model])

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

        const runtime = runtimes?.get(ent.id)
        const pd = ent.patientId ? patientDataMap?.get(ent.patientId) : undefined

        switch (def.render3D?.component) {
          case 'Bed3D':
            return <Bed3D key={ent.id} entity={ent} def={def} tileSize={model.tileSize} />
          case 'Person3D':
            return (
              <Person3D
                key={ent.id}
                entity={ent}
                def={def}
                tileSize={model.tileSize}
                runtime={runtime}
                patientData={pd}
              />
            )
          case 'DeviceMarker3D':
            return <DeviceMarker3D key={ent.id} entity={ent} def={def} tileSize={model.tileSize} />
          default:
            return null
        }
      })}
    </group>
  )
}
