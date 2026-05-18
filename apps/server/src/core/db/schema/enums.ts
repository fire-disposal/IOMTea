import { pgEnum } from 'drizzle-orm/pg-core'

// Existing enums (migrated from schema.ts with new values added)
export const roleEnum = pgEnum('role', ['admin', 'doctor', 'nurse', 'caregiver', 'patient', 'family'])
export const deviceTypeEnum = pgEnum('device_type', [
  'mattress',
  'vision',
  'imu',
  'generic',
  'simulator',
  'custom',
])
export const deviceStatusEnum = pgEnum('device_status', ['active', 'inactive', 'maintenance', 'error'])
export const patientStatusEnum = pgEnum('patient_status', ['active', 'discharged', 'archived'])
export const alertSeverityEnum = pgEnum('alert_severity', ['critical', 'warning', 'info'])
export const alertStatusEnum = pgEnum('alert_status', ['active', 'acknowledged', 'resolved', 'expired', 'new', 'assigned', 'handled', 'closed'])
export const kindEnum = pgEnum('kind', ['observation', 'alert', 'behavior', 'location'])

export const userStatusEnum = pgEnum('user_status', ['active', 'disabled', 'pending'])
export const genderEnum = pgEnum('gender', ['male', 'female', 'other'])
export const bloodTypeEnum = pgEnum('blood_type', ['A', 'B', 'AB', 'O'])
export const eventSourceEnum = pgEnum('event_source', ['iot', 'cv', 'simulator', 'manual'])
export const medicationStatusEnum = pgEnum('medication_status', ['active', 'completed', 'paused', 'cancelled'])
export const medicationRouteEnum = pgEnum('medication_route', ['oral', 'injection', 'topical', 'inhalation', 'other'])
export const adherenceStatusEnum = pgEnum('adherence_status', ['taken', 'missed', 'skipped', 'delayed'])
export const confirmationMethodEnum = pgEnum('confirmation_method', ['self', 'family', 'auto', 'unknown'])
export const appointmentTypeEnum = pgEnum('appointment_type', ['checkup', 'followup', 'emergency', 'consultation', 'rehabilitation'])
export const appointmentStatusEnum = pgEnum('appointment_status', ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
export const followupTypeEnum = pgEnum('followup_type', ['phone', 'video', 'home_visit', 'clinic', 'message'])
export const entityCategoryEnum = pgEnum('entity_category', ['furniture', 'structure', 'sensor', 'actor', 'marker'])
export const orientationEnum = pgEnum('orientation', ['N', 'S', 'E', 'W'])
export const actorPostureEnum = pgEnum('actor_posture', ['lying', 'sitting', 'standing', 'walking'])
export const behaviorStateEnum = pgEnum('behavior_state', ['idle', 'moving', 'acting', 'sleeping', 'eating', 'toilet', 'shower'])
export const behaviorRuleTypeEnum = pgEnum('behavior_rule_type', ['schedule', 'trigger', 'routine'])
export const roomTypeEnum = pgEnum('room_type', ['bedroom', 'livingroom', 'kitchen', 'bathroom', 'study', 'corridor', 'custom'])

// ── Type exports: single source of truth for strict TypeScript usage ──
export type Role = 'admin' | 'doctor' | 'nurse' | 'caregiver' | 'patient' | 'family'
export type DeviceType = 'mattress' | 'vision' | 'imu' | 'generic' | 'simulator' | 'custom'
export type DeviceStatus = 'active' | 'inactive' | 'maintenance' | 'error'
export type PatientStatus = 'active' | 'discharged' | 'archived'
export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'expired' | 'new' | 'assigned' | 'handled' | 'closed'
export type EventKind = 'observation' | 'alert' | 'behavior' | 'location'

export type UserStatus = 'active' | 'disabled' | 'pending'
export type Gender = 'male' | 'female' | 'other'
export type BloodType = 'A' | 'B' | 'AB' | 'O'
export type EventSource = 'iot' | 'cv' | 'simulator' | 'manual'
export type MedicationStatus = 'active' | 'completed' | 'paused' | 'cancelled'
export type MedicationRoute = 'oral' | 'injection' | 'topical' | 'inhalation' | 'other'
export type AdherenceStatus = 'taken' | 'missed' | 'skipped' | 'delayed'
export type ConfirmationMethod = 'self' | 'family' | 'auto' | 'unknown'
export type AppointmentType = 'checkup' | 'followup' | 'emergency' | 'consultation' | 'rehabilitation'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
export type FollowupType = 'phone' | 'video' | 'home_visit' | 'clinic' | 'message'
