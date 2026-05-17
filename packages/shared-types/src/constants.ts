export const USER_ROLES = ['admin', 'doctor', 'nurse', 'caregiver'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const ALERT_SEVERITIES = ['critical', 'warning', 'info'] as const
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number]

export const ALERT_STATUSES = ['active', 'acknowledged', 'resolved', 'new', 'assigned', 'handled', 'closed'] as const
export type AlertStatus = (typeof ALERT_STATUSES)[number]

export const PATIENT_STATUSES = ['active', 'discharged'] as const
export type PatientStatus = (typeof PATIENT_STATUSES)[number]

export const GENDERS = ['male', 'female', 'other'] as const
export type Gender = (typeof GENDERS)[number]
