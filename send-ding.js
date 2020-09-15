
const { execSync } = require('child_process')
const HOSTNAME = require('os').hostname()
const fetch = require('node-fetch')

const Dayjs = require('dayjs')
const relativeTime = require('dayjs/plugin/relativeTime')
require('dayjs/locale/zh-cn')

Dayjs.locale('zh-cn')
Dayjs.extend(relativeTime)

function getGitInfo(cwd) {

  function replaceDate(message) {
    return message.replace(/#DATE<([^>]+)>/gi, function(_, p1) {
      return new Dayjs(p1).fromNow()
    })
  }

  const options = {
    cwd,
  }
  const maxCommitNum = 5
  try {
    let commitMsgs = execSync(`git log --no-merges -n ${5} --grep="^[feat|fix]" --format=format:"* %s (@%cn #DATE<%cd>)"`, options)
      .toString().trim()
    commitMsgs = replaceDate(commitMsgs)
    const branchName = execSync('git rev-parse --abbrev-ref HEAD', options)
      .toString().trim()
    return `当前分支: **${branchName}**

最近${maxCommitNum}次commit:

${commitMsgs}`
  } catch (e) {
    console.error('获取 git 日志失败：', e)
    return ''
  }
}

module.exports = async function sendDingMsg(options = {
  alipayQRImgUrl: '',
  weappQRImgUrl: '',
  isExperience: true,
  dingTalkUrl: '',
  absConfigDir: '',
}) {
  const {
    alipayQRImgUrl,
    weappQRImgUrl,
    isExperience,
    absConfigDir,
    dingTalkUrl,
  } = options
  const gitInfo = getGitInfo(absConfigDir)

  const uploadType = isExperience ? '体验版' : '预览版'

  const alipayPart = alipayQRImgUrl && `
## 支付宝${uploadType}${isExperience ? '' : '(有效期24小时)'}：
![](${alipayQRImgUrl})
`

  const wechatPart = weappQRImgUrl && `
## 微信${uploadType}${isExperience ? '' : '(有效期半小时)'}：
![](${weappQRImgUrl})
`

  const TEMPLATE = `
# ${uploadType}小程序构建完成
---
构建时间: ${new Dayjs().format('MM-DD HH:mm')}

构建机器：${HOSTNAME}

${gitInfo}

---
${wechatPart || ''}

${alipayPart || ''}
`

  const postBody = {
    msgtype: 'markdown',
    markdown: {
      title: '小程序构建已完成',
      text: TEMPLATE,
    },
    at: {
      isAtAll: isExperience,
    }
  }

  console.log('正在推送钉钉消息...')
  // console.log(TEMPLATE)
  await fetch(dingTalkUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(postBody)
  })
  console.log('推送钉钉消息完成')
}
