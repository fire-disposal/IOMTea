export const ALERT_SEVERITY_COLORS: Record<string, string> = {
  critical: 'red', warning: 'orange', info: 'blue', resolved: 'gray',
}

export const ALERT_STATUS_LABELS: Record<string, string> = {
  active: '活跃', acknowledged: '已确认', resolved: '已解决',
}

export const PATIENT_STATUS_LABELS: Record<string, string> = {
  active: '在护', inactive: '离院', discharged: '出院',
}

export const DEVICE_TYPE_LABELS: Record<string, string> = {
  mattress: '智能床垫', vision: '视觉设备', imu: '惯性传感器',
  generic: '通用设备', simulator: '模拟器', custom: '自定义',
}

export function genderLabel(g: string | null | undefined): string {
  if (g === 'male') return '男'
  if (g === 'female') return '女'
  return '未知'
}

export const SPEEDS = [1, 2, 5, 10] as const
