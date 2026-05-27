const STORAGE_KEYS = require('../constants/storage-keys').STORAGE_KEYS

function getBase() {
  const customUrl = wx.getStorageSync(STORAGE_KEYS.SERVER_URL)
  if (customUrl) return customUrl
  if (typeof API_BASE_URL !== 'undefined') return API_BASE_URL
  return 'http://localhost:3000'
}

function getToken() {
  return wx.getStorageSync(STORAGE_KEYS.TOKEN) || null
}

function request(path, options) {
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
