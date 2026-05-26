export function parsePatientId(): string {
  return window.location.pathname.split('/patients/')[1]?.split('/')[0] || ''
}
