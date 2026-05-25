import { View, Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import './NumberInput.scss'

interface NumberInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  decimal?: boolean
}

export function NumberInput({ value, onChange, placeholder, decimal }: NumberInputProps) {
  const displayValue = value || placeholder || '0'
  const [showHint, setShowHint] = useState(false)
  const hintTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!value) {
      hintTimer.current = setTimeout(() => setShowHint(true), 2000)
    } else {
      setShowHint(false)
    }
    return () => clearTimeout(hintTimer.current)
  }, [value])

  const handleDigit = (d: string) => {
    Taro.vibrateShort()
    if (d === '.') {
      if (!decimal) return
      if (value.includes('.')) return
      onChange(value + '.')
      return
    }
    if (d === 'back') {
      onChange(value.slice(0, -1))
      return
    }
    if (value.length >= 6) return
    onChange(value + d)
  }

  return (
    <View className="number-input">
      <View className="number-input__display">
        <Text className="number-input__value">{displayValue}</Text>
        {!value && showHint && <Text className="number-input__hint">点击任意键开始输入</Text>}
      </View>
      <View className="number-input__keypad">
        <View className="number-input__row">
          {['1', '2', '3'].map((d) => (
            <View key={d} className="number-input__key" onClick={() => handleDigit(d)}>
              <Text>{d}</Text>
            </View>
          ))}
        </View>
        <View className="number-input__row">
          {['4', '5', '6'].map((d) => (
            <View key={d} className="number-input__key" onClick={() => handleDigit(d)}>
              <Text>{d}</Text>
            </View>
          ))}
        </View>
        <View className="number-input__row">
          {['7', '8', '9'].map((d) => (
            <View key={d} className="number-input__key" onClick={() => handleDigit(d)}>
              <Text>{d}</Text>
            </View>
          ))}
        </View>
        <View className="number-input__row">
          {decimal && (
            <View className="number-input__key" onClick={() => handleDigit('.')}>
              <Text>.</Text>
            </View>
          )}
          {!decimal && <View className="number-input__key number-input__key--empty" />}
          <View className="number-input__key" onClick={() => handleDigit('0')}>
            <Text>0</Text>
          </View>
          <View className="number-input__key" onClick={() => handleDigit('back')}>
            <Text>⌫</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
