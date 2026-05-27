const now = new Date()
const HOUR_MS = 60 * 60 * 1000

interface VitalBaseline {
  hr: number
  hrVar: number
  spo2: number
  spo2Var: number
  bpSys: number
  bpDia: number
  bpVar: number
  temp: number
  tempVar: number
  glucoseFast: number
  glucoseVar: number
  glucosePost: number
}

interface SeedPatient {
  username: string
  password: string
  name: string
  gender: 'male' | 'female'
  birthDate: string
  heightCm: number
  weightKg: number
  profileId: string
  conditions: string[]
  hasHomeGraph: boolean
  graphPrefix: string
  baselines: VitalBaseline
  meds: {
    drugName: string
    genericName?: string
    dosage: string
    dosageUnit: string
    frequency: string
    route: string
    instructions?: string
  }[]
  pinLabels: string[]
  alertScenarios: {
    metric: string
    value: number | null
    unit: string | null
    severity: 'critical' | 'warning' | 'info'
    tags?: Record<string, unknown>
  }[]
}

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function jitter(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range * 2
}

function round(v: number, d = 1): number {
  const m = Math.pow(10, d)
  return Math.round(v * m) / m
}

function roomId(prefix: string, type: string): string {
  return `${prefix}-${type}`
}

function activityLevel(hour: number): 'resting' | 'light' | 'moderate' {
  if (hour >= 23 || hour < 6) return 'resting'
  if ((hour >= 6 && hour < 8) || (hour >= 11 && hour < 13) || (hour >= 17 && hour < 19))
    return 'moderate'
  return 'light'
}

function generateVitals(b: VitalBaseline, hour: number) {
  const a = activityLevel(hour)
  const actMultiplier = a === 'resting' ? 0.88 : a === 'moderate' ? 1.08 : 1.0
  const afterMeal =
    (hour >= 8 && hour < 10) || (hour >= 13 && hour < 15) || (hour >= 19 && hour < 21)
  const isNight = hour >= 23 || hour < 6
  const isMorning = hour >= 6 && hour < 9

  const hr = round(jitter(b.hr * actMultiplier, b.hrVar), 0)
  const spo2 = round(jitter(b.spo2, b.spo2Var), 0)
  const bpSys = round(
    jitter(
      b.bpSys + (isMorning ? 5 : 0) + (a === 'resting' ? -8 : a === 'moderate' ? 5 : 0),
      b.bpVar,
    ),
    0,
  )
  const bpDia = round(
    jitter(b.bpDia + (a === 'resting' ? -3 : a === 'moderate' ? 3 : 0), b.bpVar * 0.6),
    0,
  )
  const temp = round(jitter(b.temp + (isNight ? -0.4 : a === 'moderate' ? 0.2 : 0), b.tempVar), 1)
  const glucose = round(jitter(b.glucoseFast + (afterMeal ? b.glucosePost : 0), b.glucoseVar), 1)
  const respRate = round(jitter(16 + (a === 'resting' ? -2 : a === 'moderate' ? 3 : 0), 3), 0)

  return { hr, spo2, bpSys, bpDia, temp, glucose, respRate }
}

function recentAlertTime(offsetHours: number): Date {
  return new Date(now.getTime() - offsetHours * HOUR_MS)
}

function buildHomeGraph(prefix: string): Record<string, unknown> {
  const rooms = [
    {
      id: roomId(prefix, 'livingroom'),
      name: '客厅',
      type: 'livingroom' as const,
      x: 300,
      y: 300,
      connections: [
        roomId(prefix, 'bedroom'),
        roomId(prefix, 'kitchen'),
        roomId(prefix, 'bathroom'),
      ],
      hasCamera: true,
      devices: [] as {
        id: string
        serialNumber: string
        deviceType: string
        status: string
        pin?: string
      }[],
    },
    {
      id: roomId(prefix, 'bedroom'),
      name: '主卧',
      type: 'bedroom' as const,
      x: 100,
      y: 300,
      connections: [roomId(prefix, 'livingroom')],
      hasCamera: false,
      devices: [] as {
        id: string
        serialNumber: string
        deviceType: string
        status: string
        pin?: string
      }[],
    },
    {
      id: roomId(prefix, 'kitchen'),
      name: '厨房',
      type: 'kitchen' as const,
      x: 500,
      y: 300,
      connections: [roomId(prefix, 'livingroom')],
      hasCamera: false,
      devices: [] as {
        id: string
        serialNumber: string
        deviceType: string
        status: string
        pin?: string
      }[],
    },
    {
      id: roomId(prefix, 'bathroom'),
      name: '浴室',
      type: 'bathroom' as const,
      x: 300,
      y: 100,
      connections: [roomId(prefix, 'livingroom')],
      hasCamera: false,
      devices: [] as {
        id: string
        serialNumber: string
        deviceType: string
        status: string
        pin?: string
      }[],
    },
  ]
  return { rooms, entryRoomId: roomId(prefix, 'livingroom'), personLocation: null }
}

const PATIENTS: SeedPatient[] = [
  {
    username: 'zhangdaye',
    password: 'password123',
    name: '张大爷',
    gender: 'male',
    birthDate: '1953-03-15',
    heightCm: 170,
    weightKg: 68,
    profileId: 'elderly-cardiac',
    conditions: ['hypertension', 'fall_risk'],
    hasHomeGraph: true,
    graphPrefix: 'zdy',
    baselines: {
      hr: 78,
      hrVar: 8,
      spo2: 96,
      spo2Var: 1.5,
      bpSys: 135,
      bpDia: 85,
      bpVar: 5,
      temp: 36.5,
      tempVar: 0.3,
      glucoseFast: 5.2,
      glucoseVar: 0.4,
      glucosePost: 3.5,
    },
    meds: [
      {
        drugName: '硝苯地平缓释片',
        genericName: 'Nifedipine',
        dosage: '30',
        dosageUnit: 'mg',
        frequency: '每日1次',
        route: 'oral',
        instructions: '早餐后服用',
      },
      {
        drugName: '阿司匹林肠溶片',
        genericName: 'Aspirin',
        dosage: '100',
        dosageUnit: 'mg',
        frequency: '每日1次',
        route: 'oral',
        instructions: '晚餐后服用',
      },
      {
        drugName: '阿托伐他汀钙片',
        genericName: 'Atorvastatin',
        dosage: '10',
        dosageUnit: 'mg',
        frequency: '每日1次',
        route: 'oral',
        instructions: '睡前服用',
      },
    ],
    pinLabels: ['客厅摄像头', '主卧传感器'],
    alertScenarios: [
      {
        metric: 'heart_rate',
        value: 145,
        unit: 'bpm',
        severity: 'critical',
        tags: { scenario: 'tachycardia' },
      },
      {
        metric: 'spo2',
        value: 88,
        unit: '%',
        severity: 'critical',
        tags: { scenario: 'low_spo2' },
      },
    ],
  },
  {
    username: 'wangnainai',
    password: 'password123',
    name: '王奶奶',
    gender: 'female',
    birthDate: '1957-08-22',
    heightCm: 158,
    weightKg: 62,
    profileId: 'diabetes',
    conditions: ['type2_diabetes', 'neuropathy'],
    hasHomeGraph: true,
    graphPrefix: 'wnn',
    baselines: {
      hr: 72,
      hrVar: 7,
      spo2: 97,
      spo2Var: 1,
      bpSys: 130,
      bpDia: 82,
      bpVar: 5,
      temp: 36.5,
      tempVar: 0.3,
      glucoseFast: 5.5,
      glucoseVar: 0.6,
      glucosePost: 5,
    },
    meds: [
      {
        drugName: '盐酸二甲双胍片',
        genericName: 'Metformin',
        dosage: '500',
        dosageUnit: 'mg',
        frequency: '每日2次',
        route: 'oral',
        instructions: '早晚餐后服用',
      },
      {
        drugName: '甘精胰岛素注射液',
        genericName: 'Insulin Glargine',
        dosage: '10',
        dosageUnit: 'IU',
        frequency: '每日1次',
        route: 'injection',
        instructions: '睡前皮下注射',
      },
    ],
    pinLabels: ['客厅摄像头', '厨房传感器'],
    alertScenarios: [
      {
        metric: 'glucose',
        value: 13.2,
        unit: 'mmol/L',
        severity: 'critical',
        tags: { scenario: 'hyperglycemia' },
      },
      {
        metric: 'glucose',
        value: 3.1,
        unit: 'mmol/L',
        severity: 'warning',
        tags: { scenario: 'hypoglycemia' },
      },
    ],
  },
  {
    username: 'lishushu',
    password: 'password123',
    name: '李叔叔',
    gender: 'male',
    birthDate: '1970-11-08',
    heightCm: 175,
    weightKg: 75,
    profileId: 'post-surgery',
    conditions: ['post_op', 'infection_risk'],
    hasHomeGraph: false,
    graphPrefix: 'lss',
    baselines: {
      hr: 85,
      hrVar: 10,
      spo2: 94,
      spo2Var: 2,
      bpSys: 125,
      bpDia: 80,
      bpVar: 6,
      temp: 37.2,
      tempVar: 0.5,
      glucoseFast: 6.0,
      glucoseVar: 0.5,
      glucosePost: 3,
    },
    meds: [
      {
        drugName: '头孢呋辛酯片',
        genericName: 'Cefuroxime',
        dosage: '250',
        dosageUnit: 'mg',
        frequency: '每日2次',
        route: 'oral',
        instructions: '早晚各一次，饭后服用',
      },
      {
        drugName: '布洛芬缓释胶囊',
        genericName: 'Ibuprofen',
        dosage: '300',
        dosageUnit: 'mg',
        frequency: '每日2次',
        route: 'oral',
        instructions: '疼痛时服用',
      },
      {
        drugName: '奥美拉唑肠溶胶囊',
        genericName: 'Omeprazole',
        dosage: '20',
        dosageUnit: 'mg',
        frequency: '每日1次',
        route: 'oral',
        instructions: '早餐前空腹服用',
      },
    ],
    pinLabels: ['主卧传感器'],
    alertScenarios: [
      {
        metric: 'temperature',
        value: 38.6,
        unit: '°C',
        severity: 'critical',
        tags: { scenario: 'postop_fever' },
      },
      {
        metric: 'systolic_bp',
        value: 85,
        unit: 'mmHg',
        severity: 'warning',
        tags: { scenario: 'hypotension' },
      },
    ],
  },
]

export { PATIENTS, generatePin, generateVitals, recentAlertTime, buildHomeGraph, HOUR_MS }
export type { SeedPatient, VitalBaseline }
