const path = require('path')
const {spawn} = require('child_process')
const fs = require('fs-extra')
const alipaydev = require('alipay-dev')

class AlipayFlow {
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
  }) {
    this.options = options
    this.QRImgUrl = null
  }

  log(...args) {
    console.log('Alipay: ', ...args)
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
    const logFilePath = path.join(outDir, 'build_alipay.log')
    const stream = fs.createWriteStream(logFilePath)
    return new Promise((resolve, reject) => {
      const cmd = 'taro build --type alipay'
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
          this.log('编译完成')
          resolve()
        }
      })
    })
  }

  async upload() {
    const {
      keyPath,
      toolId,
      appId,
      projectPath,
      outDir,
      uploadImage,
    } = this.options
    if (!fs.existsSync(keyPath)) {
      throw new Error(`${keyPath} 密钥文件不存在`)
    }
    this.log('正在上传...')

    const logFilePath = path.join(outDir, 'upload_alipay.log')
    const stream = fs.createWriteStream(logFilePath)

    alipaydev.setConfig({
      toolId,
      privateKey: fs.readFileSync(keyPath, 'utf-8'),
    })
    if (this.options.isExperience) {
      this.log('上传体验版...')
      const result = await alipaydev.miniUpload({
        project: projectPath,
        appId: appId,
        clientType: 'alipay',
        experience: true,
        onProgressUpdate(data) {
          stream.write(data.data + '\n')
        }
      })
      this.QRImgUrl = result.qrCodeUrl
    } else {
      this.log('上传预览版...')
      const qrcodeOutput = path.join(outDir, 'alipay-preview.jpg')
      await alipaydev.miniPreview({
        project: projectPath,
        appId: appId,
        qrcodeFormat: 'image',
        qrcodeOutput,
        onProgressUpdate(data) {
          stream.write(data.data + '\n')
        }
      })

      if (uploadImage) {
        this.QRImgUrl = await uploadImage(`alipay-preview-${Date.now()}.jpg`, qrcodeOutput)
      } else {
        this.log(`未提供 uploadImage 函数，无法在钉钉中嵌入二维码图片。预览版二维码图片保存在${qrcodeOutput}`)
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

module.exports = AlipayFlow
