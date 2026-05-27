const { api } = require('../../utils/api')

Page({
  data: {
    patients: [],
    selectedId: '',
    vitals: [],
    selectedName: '',
    patientNames: [],
    selectedIndex: 0,
  },

  onLoad() {
    api.get('/patients', { pageSize: 100, status: 'active' })
      .then((r) => {
        const patients = r || []
        this.setData({
          patients,
          patientNames: patients.map((p) => p.name),
          selectedId: patients.length > 0 ? patients[0].id : '',
          selectedName: patients.length > 0 ? patients[0].name : '',
        })
        if (patients.length > 0) {
          this.fetchVitals(patients[0].id)
        }
      })
      .catch(() => {})
  },

  onPickerChange(e) {
    const idx = parseInt(e.detail.value)
    const patient = this.data.patients[idx]
    if (patient) {
      this.setData({ selectedId: patient.id, selectedName: patient.name, selectedIndex: idx })
      this.fetchVitals(patient.id)
    }
  },

  fetchVitals(patientId) {
    api.get('/data/latest', { patientId })
      .then((r) => {
        this.setData({ vitals: r || [] })
      })
      .catch(() => {})
  },
})
