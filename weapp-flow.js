const path = require('path')
const {spawn} = require('child_process')
const fs = require('fs-extra')
const ci = require('miniprogram-ci')


class WeappFlow {
  constructor(options = {
    skipBuild: false,
    isExperience: true,
    toolId: '',
    appId: '',
    keyPath: '',
    projectPath: '',
    env: {},
    outDir: '',
    uploadFunc: null,
    qrcodeImageUrl: '',
    version: '1.0.0',
  }) {
    this.options = options
    this.QRImgUrl = null
  }

  log(...args) {
    console.log('Weapp: ', ...args)
  }

  async build() {
    if (this.options.skipBuild) {
      this.log('跳过编译阶段')
      return
    }
    const {
      outDir,
    } = this.options
    this.log('正在编译...')
    const logFilePath = path.join(outDir, 'build_wechat.log')
    const stream = fs.createWriteStream(logFilePath)

    return new Promise((resolve, reject) => {
      const cmd = 'taro build --type weapp'
      const proc = spawn('npx', cmd.split(' '), {
        env: {
          ...process.env,
          ...this.options.env
        }
      })
      proc.stdout.on('data', data => {
        stream.write(data)
      })

      proc.stderr.on('data', data => {
        stream.write(data)
      })

      proc.on('error', (e) => {
        console.error(`error: ${ e.message }`)
        reject(e)
      })

      proc.on('close', code => {
        if (code !== 0) {
          this.log(`Failed building. See ${ logFilePath }`)
          reject(`Exit code: ${ code }`)
        } else {
          this.log('Done building.')
          resolve()
        }
      })
    })
  }

  async upload() {
    const {
      keyPath,
      appId,
      projectPath,
      outDir,
      uploadImage,
      version,
      qrcodeImageUrl,
    } = this.options
    if (!fs.existsSync(keyPath)) {
      throw new Error(`${keyPath} 密钥文件不存在`)
    }
    this.log('正在上传...')

    const logFilePath = path.join(outDir, 'upload_wechat.log')
    const stream = fs.createWriteStream(logFilePath)

    const project = new ci.Project({
      appid: appId,
      type: 'miniProgram',
      projectPath: projectPath,
      privateKeyPath: keyPath,
    })

    if (this.options.isExperience) {
      this.log('上传体验版...')
      await ci.upload({
        project,
        version,
        desc: 'auto-upload',
        robot: 1,
        onProgressUpdate(data) {
          stream.write(data.toString() + '\n')
        }
      })
      // 微信体验版地址不会变，直接写死
      this.QRImgUrl = qrcodeImageUrl
    } else {
      this.log('上传预览版...')
      const qrcodeOutputDest = path.join(outDir, 'wechat-preview.jpg')
      await ci.preview({
        project,
        desc: 'Uploaded by taro-deploy',
        qrcodeFormat: 'image',
        qrcodeOutputDest,
        onProgressUpdate(data) {
          stream.write(data.toString() + '\n')
        }
      })
      if (uploadImage) {
        this.QRImgUrl = await uploadImage(`weapp-preview-${Date.now()}.jpg`, qrcodeOutputDest)
      } else {
        this.log(`未提供 uploadImage 函数，无法在钉钉中嵌入二维码图片。预览版二维码图片保存在${qrcodeOutputDest}`)
      }
    }

    this.log('上传完成')
  }

  async run () {
    await this.build()
    await this.upload()
    return this.QRImgUrl
  }
}

module.exports = WeappFlow
