import quotes from 'shell-quote'
import shell from '@cush/shell'
import exec from '@cush/exec'
import path from 'path'
import fs from 'saxon/sync'

const fixtureDir = path.resolve(__dirname, '../spec/__fixtures__')
process.chdir(fixtureDir)

process.exit = (code = 0) => {
  throw Error('Process exited with code ' + code)
}

afterEach(() => {
  process.chdir(fixtureDir)
  const stdout = shell.sync(`
    git checkout HEAD . &>/dev/null
    git clean -df &>/dev/null

    # Find the untracked git submodules
    git status --porcelain -s | grep '??' | cut -d' ' -f2-
  `)

  // Remove untracked git submodules.
  stdout
    .split('\n')
    .forEach(name => !name.startsWith('../') && fs.remove(name, true))
})

Object.assign(global, {
  fs,
  indo(cmd: string) {
    const argv = quotes.parse(cmd) as string[]
    process.argv = ['', ''].concat(argv)

    let promise: any
    jest.isolateModules(() => {
      promise = jest.requireActual('../src/cli.ts')
    })
    return promise
  },
})
