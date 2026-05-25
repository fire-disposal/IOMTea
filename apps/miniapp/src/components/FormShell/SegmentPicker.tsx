import { Text, View } from '@tarojs/components'
import './SegmentPicker.scss'

interface SegmentOption {
  value: string
  label: string
}

interface SegmentPickerProps {
  options: SegmentOption[]
  value: string
  onChange: (v: string) => void
}

export function SegmentPicker({ options, value, onChange }: SegmentPickerProps) {
  return (
    <View className="segment-picker">
      {options.map((opt) => (
        <View
          key={opt.value}
          className={`segment-picker__item ${value === opt.value ? 'segment-picker__item--active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          <Text>{opt.label}</Text>
        </View>
      ))}
    </View>
  )
}
