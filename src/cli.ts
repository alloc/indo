import { isTest } from '@alloc/is-dev'
import { join } from 'path'
import { loadConfig, RootConfig } from './core/config'
import { fatal, log } from './core/helpers'
import { fs } from './core/fs'

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
  fatal('Unknown command:', log.lcyan('indo ' + cmd))
}

export default (async () => {
  if (helpArg) {
    require('./core/printHelp').printHelp(cmdPath)
    return
  }

  const slurm = require('slurm')
  slurm.error = reason => {
    if (reason) log.error(reason)
    process.exit(1)
  }

  if (!process.env.DEBUG) {
    // tslint:disable-next-line
    console.debug = console.time = console.timeEnd = () => {}
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
    slurm.error(err)
  }
})()

declare global {
  interface NodeRequire {
    (name: 'slurm'): import('slurm').ISlurm
  }
}
