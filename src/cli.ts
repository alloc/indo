import { isTest } from '@alloc/is-dev'
import { join } from 'path'
import { loadConfig, RootConfig } from './core/config'
import { fatal, cyan, log, red } from './core/helpers'
import { fs } from './core/fs'

// Avoid leaking NODE_OPTIONS into other processes.
process.env.NODE_OPTIONS = ''

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
      mv: 'move',
      rename: 'move',
    }
    cmd = aliases[cmd] || cmd
  }
} else {
  cmd = 'default'
}

const cmdExt = isTest ? '.ts' : '.js'

const cmdPath = join(__dirname, 'commands', cmd + cmdExt)
if (helpArg !== 'help' && !fs.exists(cmdPath)) {
  fatal('Unknown command:', cyan('indo ' + cmd))
}

export default (async () => {
  if (helpArg) {
    if (process.stdout.isTTY) {
      return require('@cush/shell').sync(`indo ${cmd} -h | less -r`, {
        env: { ...process.env, FORCE_COLOR: '1' },
        stdio: 'inherit',
      })
    }
    require('./core/printHelp').printHelp(cmdPath)
    return
  }

  const slurm = require('slurm')
  slurm.error = fatal

  if (process.env.DEBUG) {
    log.on('debug', args => console.debug(...args))
  }
  if (!isTest) {
    process.env.FORCE_COLOR = '1'

    log.on('error', args => {
      let fmt = typeof args[0] == 'string' ? args.splice(0, 1)[0] : ''

      // Add the prefix to lines without it.
      const prefix = red('[!]')
      fmt = fmt.replace(
        fmt.startsWith(prefix) ? /(\n)/g : /(^|\n)/g,
        `$1${prefix} `
      )

      console.error(fmt, ...args)
    })
  }

  let config: RootConfig | null = null
  if (cmd !== 'init') {
    config = loadConfig()
    if (!config && cmd !== 'link' && cmd !== 'unlink') {
      config = require('./commands/init').default()
    }
  }

  try {
    await require(cmdPath).default(config)
    !isTest && process.exit()
  } catch (err) {
    if (isTest) {
      throw err
    }
    fatal(err)
  }
})()

declare global {
  interface NodeRequire {
    (name: 'slurm'): import('slurm').ISlurm
  }
}
