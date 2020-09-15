#!/usr/bin/env node

const path = require('path')
const { execSync} = require('child_process')
const merge = require('merge')
const fs = require('fs-extra')
const AlipayFlow = require('./alipay-flow')
const WeappFlow = require('./weapp-flow')
const sendDing = require('./send-ding')

const {argv} = require('yargs')
  .option('config', {
    default: './deploy-config.js',
    describe: '配置文件路径'
  })

const log = console.log

function getAbsPath(p) {
  if (path.isAbsolute(p)) return p
  return path.join(process.cwd(), p)
}

let absConfigPath = getAbsPath(argv.config)

let absConfigDir = path.dirname(absConfigPath)

if (!fs.existsSync(absConfigPath)) {
  log(`配置文件 ${absConfigPath} 不存在`)
  process.exit(1)
}

const defaultConfig = require('./defaultConfig')
const theConfig = merge(defaultConfig, require(absConfigPath))

if (theConfig.outDir) {
  theConfig.outDir = getAbsPath(theConfig.outDir)
  fs.ensureDirSync(theConfig.outDir)
}

async function sendDingMsg(alipayQRImgUrl, weappQRImgUrl) {
  if (!alipayQRImgUrl && !weappQRImgUrl) {
    log('缺少二维码，不推送钉钉消息')
    return
  }

  if (!theConfig.dingTalkUrl) {
    log('缺少 dingTalkUrl 配置，不推送钉钉消息')
    return
  }

  const options = {
    alipayQRImgUrl,
    weappQRImgUrl,
    isExperience: theConfig.isExperience,
    dingTalkUrl: theConfig.dingTalkUrl,
    absConfigDir,
  }
  await sendDing(options)
}

function npmInstall () {
  if (!theConfig.npmInstall) {
    log('Skip npm install.')
    return
  }
  log('npm install...')
  execSync('npm install --silent', {
    cwd: absConfigDir,
  })
}

async function main() {
  try {
    await npmInstall()

    const promises = []
    let alipayQRImgUrl, weappQRImgUrl

    if (theConfig.alipay && theConfig.alipay.enable) {
      const alipayFlow = new AlipayFlow({
        ...theConfig,
        ...theConfig.alipay,
        keyPath: getAbsPath(theConfig.alipay.keyPath),
        projectPath: getAbsPath(theConfig.alipay.projectPath),
      })
      promises.push(alipayFlow.run().then(val => alipayQRImgUrl = val))
    }

    if (theConfig.weapp && theConfig.weapp.enable) {
      const weappFlow = new WeappFlow({
        ...theConfig,
        ...theConfig.weapp,
        keyPath: getAbsPath(theConfig.weapp.keyPath),
        projectPath: getAbsPath(theConfig.weapp.projectPath),
      })
      promises.push(weappFlow.run().then(val => weappQRImgUrl = val))
    }

    await Promise.all(promises)
    await sendDingMsg(alipayQRImgUrl, weappQRImgUrl)
    log('All done.')
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

main()
