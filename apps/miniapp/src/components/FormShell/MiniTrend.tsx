import { Canvas, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import './MiniTrend.scss'

interface MiniTrendProps {
  data: { value: number; date: string }[]
  width?: number
  height?: number
  formatValue?: (value: number) => string
  unitLabel?: string
  normalRange?: { min: number; max: number }
}

function renderCanvas(
  node: any,
  data: { value: number }[],
  width: number,
  height: number,
) {
  const canvas = node as HTMLCanvasElement
  const dpr = Taro.getSystemInfoSync().pixelRatio || 2
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)

  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = width / (data.length - 1)

  ctx.beginPath()
  ctx.strokeStyle = '#6BA539'
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'

  data.forEach((d, i) => {
    const x = i * step
    const y = height - ((d.value - min) / range) * (height - 10) - 5
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  data.forEach((d, i) => {
    const x = i * step
    const y = height - ((d.value - min) / range) * (height - 10) - 5
    ctx.beginPath()
    ctx.fillStyle = i === data.length - 1 ? '#6BA539' : '#8EC15B'
    ctx.arc(x, y, i === data.length - 1 ? 3 : 2, 0, Math.PI * 2)
    ctx.fill()
  })
}

export function MiniTrend({
  data,
  width = 280,
  height = 60,
  formatValue,
  unitLabel,
  normalRange,
}: MiniTrendProps) {
  useEffect(() => {
    if (data.length < 2) return
    const query = Taro.createSelectorQuery()
    query.select('#mini-trend-canvas').node((res: any) => {
      if (res?.[0]?.node) {
        renderCanvas(res[0].node, data, width, height)
      }
    }).exec()
  }, [data, width, height])

  if (data.length < 2) return <Text className="mini-trend__empty">最近7天暂无数据</Text>

  const latest = data[data.length - 1]
  const displayValue = formatValue ? formatValue(latest.value) : String(latest.value)

  let valueColor = 'var(--brand-500)'
  if (normalRange) {
    if (latest.value < normalRange.min) valueColor = 'var(--color-warning)'
    else if (latest.value > normalRange.max) valueColor = 'var(--color-error)'
  }

  return (
    <View className="mini-trend-wrapper">
      <View className="mini-trend-label">
        <Text className="mini-trend-value" style={{ color: valueColor }}>{displayValue}</Text>
        {unitLabel && <Text className="mini-trend-unit">{unitLabel}</Text>}
      </View>
      <Canvas type="2d" id="mini-trend-canvas" canvasId="mini-trend-canvas" style={{ width: `${width}px`, height: `${height}px` }} className="mini-trend" />
    </View>
  )
}
