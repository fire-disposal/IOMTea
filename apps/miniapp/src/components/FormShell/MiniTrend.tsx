import { Canvas, Text, View } from '@tarojs/components'
import { useEffect, useRef } from 'react'
import './MiniTrend.scss'

interface MiniTrendProps {
  data: { value: number; date: string }[]
  width?: number
  height?: number
  formatValue?: (value: number) => string
  unitLabel?: string
}

export function MiniTrend({
  data,
  width = 280,
  height = 60,
  formatValue,
  unitLabel,
}: MiniTrendProps) {
  const canvasRef = useRef<any>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = 2
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const values = data.map((d) => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const step = width / (data.length - 1)

    ctx.beginPath()
    ctx.strokeStyle = '#4a90d9'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'

    data.forEach((d, i) => {
      const x = i * step
      const y = height - ((d.value - min) / range) * (height - 10) - 5
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()

    data.forEach((d, i) => {
      const x = i * step
      const y = height - ((d.value - min) / range) * (height - 10) - 5
      ctx.beginPath()
      ctx.fillStyle = i === data.length - 1 ? '#4a90d9' : '#a0c4e8'
      ctx.arc(x, y, i === data.length - 1 ? 3 : 2, 0, Math.PI * 2)
      ctx.fill()
    })
  }, [data, width, height])

  if (data.length < 2) return <Text className="mini-trend__empty">最近7天暂无数据</Text>

  const latest = data[data.length - 1]
  const displayValue = formatValue ? formatValue(latest.value) : String(latest.value)

  return (
    <View className="mini-trend-wrapper">
      <View className="mini-trend-label">
        <Text className="mini-trend-value">{displayValue}</Text>
        {unitLabel && <Text className="mini-trend-unit">{unitLabel}</Text>}
      </View>
      <Canvas ref={canvasRef} style={{ width, height }} className="mini-trend" />
    </View>
  )
}
