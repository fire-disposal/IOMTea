export const USER_ROLES = ['admin', 'doctor', 'nurse', 'caregiver'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const DEVICE_TYPES = ['mattress', 'vision', 'imu', 'generic', 'simulator', 'custom'] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]

export const DEVICE_STATUSES = ['active', 'inactive', 'maintenance'] as const
export type DeviceStatus = (typeof DEVICE_STATUSES)[number]

export const ALERT_SEVERITIES = ['critical', 'warning', 'info'] as const
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number]

export const ALERT_STATUSES = ['active', 'acknowledged', 'resolved'] as const
export type AlertStatus = (typeof ALERT_STATUSES)[number]

export const ALERT_TYPES = ['fall_detected', 'bed_exit', 'vital_anomaly', 'device_offline'] as const
export type AlertType = (typeof ALERT_TYPES)[number]

export const GENDERS = ['male', 'female', 'other'] as const
export type Gender = (typeof GENDERS)[number]

export const PATIENT_STATUSES = ['active', 'discharged'] as const
export type PatientStatus = (typeof PATIENT_STATUSES)[number]
