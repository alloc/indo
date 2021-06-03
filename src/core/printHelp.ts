import { basename, join, resolve } from 'path'
import { fatal, log, cyan } from './helpers'
import { fs } from './fs'
import k from 'kleur'

export function printHelp(cmdPath: string) {
  const helpPath = join(
    resolve(cmdPath, '../../../help'),
    basename(cmdPath).replace(/\.js$/, '.md')
  )
  if (fs.exists(helpPath)) {
    let help = ''

    const rawHelp = fs.read(helpPath)
    const tagRE = /<((?:\/[ ]*)?)([\w]+)>|([`])|([*])/g
    const opened: { name: string; index: number; text: string }[] = []
    let lastIndex = 0
    let match
    while ((match = tagRE.exec(rawHelp))) {
      let [, close, name, isCyan, isBold] = match
      if (isCyan || isBold) {
        name = isCyan ? 'cyan' : 'bold'
        close = opened.length && name == opened[0].name ? '/' : ''
      }
      if (close) {
        const text = k[opened[0].name](
          opened[0].text + rawHelp.slice(opened[0].index, match.index)
        )
        lastIndex = match.index + match[0].length
        if (name == opened[0].name) {
          opened.shift()
          if (opened.length) {
            opened[0].text += text
            opened[0].index = lastIndex
          } else {
            help += text
          }
        }
      } else {
        const isEscaped = rawHelp[match.index - 1] == '\\'
        let text = rawHelp.slice(lastIndex, match.index - (isEscaped ? 1 : 0))
        lastIndex = match.index + match[0].length
        if (isEscaped) {
          text += rawHelp.slice(match.index, lastIndex)
        }
        if (opened.length) {
          opened[0].text += text
          opened[0].index = lastIndex
        } else {
          help += text
        }
        if (!isEscaped) {
          opened.unshift({ name, index: lastIndex, text: '' })
        }
      }
    }
    help += rawHelp.slice(lastIndex)
    for (const { name } of opened) {
      fatal('Forgot to close', cyan(`<${name}>`))
    }
    log(help)
  }
}
