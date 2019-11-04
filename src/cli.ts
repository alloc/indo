import { basename, join, resolve } from 'path'
import { loadConfig, RootConfig } from './core/config'
import { fs } from './core/fs'
import { fatal, log } from './core/helpers'

const helpArg = process.argv.find(
  arg => arg == 'help' || arg == '--help' || arg == '-h'
)

let cmd = process.argv[2]
if (cmd && cmd[0] !== '-') {
  process.argv.splice(2, 1)
  if (cmd == helpArg) {
    cmd = 'default'
  } else {
    const aliases = {
      ls: 'list',
      rm: 'remove',
    }
    cmd = aliases[cmd] || cmd
  }
} else {
  cmd = 'default'
}

const cmdPath = join(__dirname, 'commands', cmd + '.js')
if (helpArg !== 'help' && !fs.exists(cmdPath)) {
  fatal('Unknown command:', log.lcyan('indo ' + cmd))
}

if (helpArg) {
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
  process.exit()
}

import slurm from 'slurm'
slurm.error = reason => {
  if (reason) log.error(reason)
  process.exit(1)
}

let config: RootConfig | null = null
if (cmd !== 'init') {
  config = loadConfig()
  if (!config && cmd !== 'link' && cmd !== 'unlink') {
    config = require('./commands/init').default()
  }
}

Promise.resolve()
  .then(() => require(cmdPath).default(config))
  .then(() => process.exit())
  .catch(slurm.error)
