#!/usr/bin/env node
import log from 'lodge'
import { basename, join, resolve } from 'path'
import fs from 'saxon/sync'
import { loadConfig, RootConfig } from './core/config'
import { fatal } from './core/helpers'

let cmd = process.argv[2]
if (cmd && cmd[0] !== '-') {
  process.argv.splice(2, 1)
} else {
  cmd = 'default'
}

const cmdPath = join(__dirname, 'commands', cmd + '.js')
if (!fs.exists(cmdPath)) {
  fatal('Unknown command:', log.lcyan('indo ' + cmd))
}

if (process.argv.find(arg => arg == 'help' || arg == '--help' || arg == '-h')) {
  const helpPath = join(
    resolve(cmdPath, '../../../help'),
    basename(cmdPath).replace(/\.js$/, '.md')
  )
  if (fs.exists(helpPath)) {
    log(fs.read(helpPath))
  }
  process.exit()
}

import slurm from 'slurm'
slurm.error = reason => {
  log.error(reason)
  process.exit(1)
}

let config: RootConfig | null = null
if (cmd !== 'init') {
  config = loadConfig()
  if (!config) {
    config = require('./commands/init').default()
    if (!config) {
      fatal('Missing config')
    }
  }
}

Promise.resolve()
  .then(() => require(cmdPath).default(config))
  .then(() => process.exit())
  .catch(fatal)
