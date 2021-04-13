import { basename, join, resolve } from 'path'
import { fatal, log } from './helpers'
import { fs } from './fs'

export function printHelp(cmdPath: string) {
  const helpPath = join(
    resolve(cmdPath, '../../../help'),
    basename(cmdPath).replace(/\.js$/, '.md')
  )
  if (fs.exists(helpPath)) {
    let help = ''

    const rawHelp = fs.read(helpPath)
    const tagRE = /<((?:\/[ ]*)?)([\w]+)>|([`])|([*])/g
    const opened: { [key: string]: number } = {}
    let lastIndex = 0
    let match
    while ((match = tagRE.exec(rawHelp))) {
      let [, close, name, lcyan, bold] = match
      if (lcyan || bold) {
        name = lcyan ? 'lcyan' : 'bold'
        close = opened[name] ? '/' : ''
      }
      if (close) {
        const index = opened[name]
        if (index !== void 0) {
          delete opened[name]
          help += log[name](rawHelp.slice(index, match.index))
          lastIndex = match.index + match[0].length
        }
      } else {
        help += rawHelp.slice(lastIndex, match.index)
        opened[name] = lastIndex = match.index + match[0].length
      }
    }
    help += rawHelp.slice(lastIndex)
    for (const name in opened) {
      fatal('Forgot to close', log.lcyan(`<${name}>`))
    }
    log(help)
  }
}
