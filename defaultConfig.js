module.exports = {
  outDir: './deploy-out',

  weapp: {
    enable: true,
    projectPath: './dist/weapp',
    keyPath: './weapp.key',
    appId: '',
    qrcodeImageUrl: '',
    version: '1.0.0',
  },

  alipay: {
    enable: true,
    projectPath: './dist/alipay',
    keyPath: './alipay.key',
    appId: '',
    toolId: '',
  },

  env: {

  },

  isExperience: true,

  npmInstall: true,

  uploadImage: async function() {
    return ''
  }
}