const HEALTH_MODULE_KEYS = [
  'blood_glucose',
  'blood_pressure',
  'weight',
  'heart_rate',
  'temperature',
  'spo2',
  'medication',
  'period',
]

const HEALTH_MODULE_META = {
  blood_glucose: { label: '血糖', unit: 'mmol/L', icon: '🩸' },
  blood_pressure: { label: '血压', unit: 'mmHg', icon: '❤️' },
  weight: { label: '体重', unit: 'kg', icon: '⚖️' },
  heart_rate: { label: '心率', unit: 'bpm', icon: '💓' },
  temperature: { label: '体温', unit: '°C', icon: '🌡️' },
  spo2: { label: '血氧', unit: '%', icon: '🫁' },
  medication: { label: '用药', unit: '', icon: '💊' },
  period: { label: '生理期', unit: '', icon: '🌸' },
}

const HEALTH_MODULE_LABELS = {
  blood_glucose: '血糖',
  blood_pressure: '血压',
  weight: '体重',
  heart_rate: '心率',
  temperature: '体温',
  spo2: '血氧',
  medication: '用药',
  period: '生理期',
}

const PIN_TYPE_LABELS = {
  device: '设备',
  virtual: '虚拟',
  user: '用户',
  simulator: '仿真',
}

function getRecordPage(key) {
  const pages = {
    blood_glucose: '/pages/record/glucose/index',
    blood_pressure: '/pages/record/pressure/index',
    weight: '/pages/record/weight/index',
    heart_rate: '/pages/record/heart-rate/index',
    temperature: '/pages/record/temperature/index',
    spo2: '/pages/record/spo2/index',
    medication: '/pages/record/medication/index',
    period: '/pages/record/period/index',
  }
  return pages[key] || ''
}

module.exports = {
  HEALTH_MODULE_KEYS,
  HEALTH_MODULE_META,
  HEALTH_MODULE_LABELS,
  PIN_TYPE_LABELS,
  getRecordPage,
}
