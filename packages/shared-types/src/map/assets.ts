import type { AssetDef, Sprite2D } from './types'

export const ASSET_DEFS: AssetDef[] = [
  {
    id: 'bed',
    sprite2D: { shape: 'rect', color: '#8B7355', size: [0.9, 0.9], label: '床' },
    model3D: { type: 'box', color: '#8B7355', args: [2, 0.3, 1] },
  },
  {
    id: 'table',
    sprite2D: { shape: 'rect', color: '#A0846B', size: [0.9, 0.8], label: '桌' },
    model3D: { type: 'box', color: '#A0846B', args: [1.6, 0.8, 0.8] },
  },
  {
    id: 'sofa',
    sprite2D: { shape: 'rect', color: '#6B8F71', size: [0.95, 0.8], label: '沙发' },
    model3D: { type: 'box', color: '#6B8F71', args: [1.8, 0.6, 0.8] },
  },
  {
    id: 'cabinet',
    sprite2D: { shape: 'rect', color: '#A0846B', size: [0.8, 0.8], label: '柜' },
  },
  {
    id: 'toilet',
    sprite2D: { shape: 'circle', color: '#E8E8E8', size: [0.6, 0.6], label: '马桶' },
  },
  {
    id: 'sink',
    sprite2D: { shape: 'circle', color: '#B0C4DE', size: [0.6, 0.6], label: '水池' },
  },
  {
    id: 'person',
    sprite2D: { shape: 'circle', color: '#4CAF50', size: [0.5, 0.5], label: '人' },
    model3D: { type: 'capsule', color: '#f5c6a0', args: [0.2, 1.2, 4, 8] },
  },
  {
    id: 'mattress_sensor',
    sprite2D: { shape: 'diamond', color: '#2196F3', size: [0.4, 0.4], label: '床垫' },
    model3D: { type: 'sphere', color: '#2196F3', args: [0.12, 16, 16], emissiveColor: '#00cc66' },
  },
  {
    id: 'air_sensor',
    sprite2D: { shape: 'diamond', color: '#00BCD4', size: [0.35, 0.35], label: '环境' },
  },
  {
    id: 'emergency_btn',
    sprite2D: { shape: 'circle', color: '#F44336', size: [0.35, 0.35], label: '紧急' },
    model3D: { type: 'sphere', color: '#F44336', args: [0.12, 16, 16], emissiveColor: '#ff3333' },
  },
  {
    id: 'motion_sensor',
    sprite2D: { shape: 'diamond', color: '#FF9800', size: [0.35, 0.35], label: '体动' },
  },
  {
    id: 'tv',
    sprite2D: { shape: 'rect', color: '#424242', size: [0.5, 0.2], label: 'TV' },
  },
  {
    id: 'door',
    sprite2D: { shape: 'line', color: '#795548', size: [0.15, 0.8], label: '门' },
    model3D: { type: 'box', color: '#795548', args: [0.15, 2.2, 1] },
  },
  {
    id: 'window',
    sprite2D: { shape: 'line', color: '#90CAF9', size: [0.15, 0.8], label: '窗' },
  },
]

export function getAsset(id: string): AssetDef | undefined {
  return ASSET_DEFS.find((a) => a.id === id)
}

export function getSpriteForOrientation(asset: AssetDef, _orientation: string): Sprite2D {
  return asset.sprite2D
}
