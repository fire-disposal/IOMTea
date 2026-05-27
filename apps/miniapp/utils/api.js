const STORAGE_KEYS = require('../constants/storage-keys').STORAGE_KEYS

function isDevMode() {
  return wx.getStorageSync('dev_mode') === true
}

function getMock(path, method) {
  const patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || 'dev-patient-001'

  const mocks = {
    'GET /users/me': { id: 'dev-user-001', username: 'dev', displayName: '开发者', role: 'admin', credit: 999, status: 'active' },
    'GET /plans/today': [{ id: 'dev-plan-1', code: 'blood_glucose', title: '血糖记录', rewardCredits: 10, fields: [] }, { id: 'dev-plan-2', code: 'blood_pressure', title: '血压记录', rewardCredits: 10, fields: [] }, { id: 'dev-plan-3', code: 'medication', title: '按时服药', rewardCredits: 15, fields: [] }],
    'GET /patients/mine': [{ id: 'dev-patient-001', name: '演示患者', status: 'active' }],
    'GET /patients': [{ id: 'dev-patient-001', name: '演示患者', gender: 'male', birthDate: '1960-05-15', status: 'active' }],
    'GET /alerts': [{ id: 'dev-alert-1', patientId: 'dev-patient-001', metric: 'heart_rate', value: 155, severity: 'critical', status: 'active', recordedAt: new Date().toISOString() }, { id: 'dev-alert-2', patientId: 'dev-patient-001', metric: 'spo2', value: 88, severity: 'warning', status: 'active', recordedAt: new Date(Date.now() - 3600000).toISOString() }],
    'GET /credits/balance': { balance: 999 },
    'GET /credits/transactions': [{ id: 'tx-1', userId: 'dev-user-001', amount: 10, kind: 'earn', source: 'plan', description: '完成: 血糖记录', createdAt: new Date().toISOString() }, { id: 'tx-2', userId: 'dev-user-001', amount: 5, kind: 'earn', source: 'streak', description: '连续记录', createdAt: new Date(Date.now() - 86400000).toISOString() }],
    'GET /pins': [{ pin: '123456', userId: 'dev-user-001', type: 'device', label: '演示设备' }],
    'GET /forms': [{ id: 'dev-form-1', code: 'sleep_quality', title: '睡眠质量评估', description: '评估过去一周的睡眠状况', fields: [{ id: 'q1', type: 'likert', label: '入睡困难程度', labels: ['无', '轻度', '中度', '重度', '极重'], required: true }], status: 'published' }],
    'GET /data/latest': [{ metric: 'heart_rate', value: 72, unit: 'bpm', recordedAt: Date.now() }, { metric: 'spo2', value: 98, unit: '%', recordedAt: Date.now() }, { metric: 'temperature', value: 36.5, unit: '°C', recordedAt: Date.now() }],
    'POST /plans': { success: true },
    'POST /ingest/batch': { success: true, created: 1, failed: 0 },
  }

  // Dynamic path matching
  if (method === 'POST' && path.indexOf('/plans/') === 0 && path.indexOf('/complete') > -1) {
    return { id: 'dev-completion-1', planId: 'dev-plan-1', patientId: patientId, creditsEarned: 10 }
  }
  if (method === 'GET' && path.indexOf('/forms/') === 0 && path.indexOf('/respond') === -1) {
    var formCode = path.split('/')[2]
    return { id: 'dev-form-1', code: formCode || 'demo', title: '演示量表', description: '开发者模式演示', fields: [{ id: 'q1', type: 'choice', label: '示例问题', options: [{ value: 'a', label: '选项A' }, { value: 'b', label: '选项B' }], required: true }], status: 'published' }
  }
  if (method === 'POST' && path.indexOf('/forms/') === 0 && path.indexOf('/respond') > -1) {
    return { id: 'dev-resp-1', formCode: path.split('/')[2], patientId: patientId }
  }

  return mocks[method + ' ' + path] || null
}

function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms) })
}

function getBase() {
  const customUrl = wx.getStorageSync(STORAGE_KEYS.SERVER_URL)
  if (customUrl) return customUrl
  return 'http://localhost:3000'
}

function getToken() {
  return wx.getStorageSync(STORAGE_KEYS.TOKEN) || null
}

function request(path, options) {
  if (isDevMode()) {
    var mock = getMock(path, (options && options.method) || 'GET')
    if (mock !== null) {
      return delay(200 + Math.random() * 300).then(function () { return mock })
    }
    return delay(200).then(function () { return {} })
  }

  const { method, body, params } = options || {}
  const httpMethod = method || 'GET'
  const base = getBase()
  let token = getToken()

  let url = base + path
  if (params) {
    const parts = []
    for (const k of Object.keys(params)) {
      const v = params[k]
      if (v !== undefined) parts.push(k + '=' + encodeURIComponent(String(v)))
    }
    if (parts.length) url += '?' + parts.join('&')
  }

  function authHeader(t) {
    return t
      ? { Authorization: 'Bearer ' + t, 'content-type': 'application/json' }
      : { 'content-type': 'application/json' }
  }

  return new Promise((resolve, reject) => {
    function doRequest(authToken) {
      wx.request({
        url,
        method: httpMethod,
        header: authHeader(authToken),
        data: body,
        success(res) {
          if (res.statusCode !== 401) {
            resolve(res.data)
            return
          }

          const refreshToken = wx.getStorageSync(STORAGE_KEYS.REFRESH_TOKEN)
          if (!refreshToken) {
            wx.removeStorageSync(STORAGE_KEYS.TOKEN)
            wx.reLaunch({ url: '/pages/login/index' })
            reject(new Error('Unauthorized'))
            return
          }

          wx.request({
            url: base + '/auth/refresh',
            method: 'POST',
            data: { refreshToken },
            header: { 'content-type': 'application/json' },
            success(refreshRes) {
              if (refreshRes.statusCode === 200) {
                const d = refreshRes.data
                wx.setStorageSync(STORAGE_KEYS.TOKEN, d.accessToken)
                if (d.refreshToken) wx.setStorageSync(STORAGE_KEYS.REFRESH_TOKEN, d.refreshToken)
                doRequest(d.accessToken)
                return
              }
              wx.removeStorageSync(STORAGE_KEYS.TOKEN)
              wx.removeStorageSync(STORAGE_KEYS.REFRESH_TOKEN)
              wx.reLaunch({ url: '/pages/login/index' })
              reject(new Error('Unauthorized'))
            },
            fail() {
              wx.removeStorageSync(STORAGE_KEYS.TOKEN)
              wx.removeStorageSync(STORAGE_KEYS.REFRESH_TOKEN)
              wx.reLaunch({ url: '/pages/login/index' })
              reject(new Error('Unauthorized'))
            }
          })
        },
        fail(err) {
          reject(err)
        }
      })
    }
    doRequest(token)
  })
}

const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' })
}

module.exports = { api }
