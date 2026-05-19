export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/login/index',
    'pages/alerts/index',
    'pages/devices/index',
    'pages/data/index',
    'pages/settings/index',
    'pages/export/index',
    'pages/health/index',
    'pages/messages/index',
    'pages/profile/index',
    'pages/records/index',
    'pages/settings/goals/index',
    'pages/settings/tracking/index',
    'pages/pin-overview/index',
    'pages/plan/index',
    'pages/plan/detail/index',
    'pages/credit/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#416323',
    navigationBarTitleText: 'IOMTea',
    navigationBarTextStyle: 'white',
  },
  permission: {
    'scope.userLocation': {
      desc: '需要获取您的位置信息用于设备定位',
    },
  },
})
