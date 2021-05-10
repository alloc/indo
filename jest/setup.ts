import stripAnsi from 'strip-ansi'
import quotes from 'shell-quote'
import shell from '@cush/shell'
import path from 'path'
import util from 'util'
import fs from 'saxon/sync'

const fixtureDir = path.resolve(__dirname, '../spec/__fixtures__')
process.chdir(fixtureDir)

const { exit } = process
beforeEach(() => {
  logs.length = 0
  process.exit = (code = 0) => {
    throw Error('Process exited with code ' + code)
  }
})

afterEach(() => {
  process.exit = exit
  process.chdir(fixtureDir)
  const stdout = shell.sync(`
    git checkout HEAD . &>/dev/null
    git clean -df &>/dev/null

    # Find the untracked git submodules
    git status --porcelain -s | grep '??' | cut -d' ' -f2-
  `)

  // Remove untracked git submodules.
  if (stdout)
    stdout.split('\n').forEach(name => {
      if (!name.startsWith('../')) {
        fs.remove(name, true)
      }
    })
})

Object.assign(global, {
  fs,
  logs: [],
  indo(cmd = '') {
    const argv = quotes.parse(cmd) as string[]
    process.argv = ['', '', '--config', '.'].concat(argv)

    let promise: any
    jest.isolateModules(() => {
      promise = jest.requireActual('../src/cli.ts').default
    })
    return promise
  },
})

// Track logs for testing purposes.
import sharedLog from 'shared-log'
sharedLog.on('all', (level, args) => {
  if (level == 'debug') return
  args = args.map(arg => (typeof arg == 'string' ? arg : util.inspect(arg)))
  logs.push(
    // Strip ansi colors and elapsed time.
    stripAnsi(args.join(' ')).replace(/:?\s+[0-9]+(\.[0-9]+)?(s|ms)$/, '')
  )
})
