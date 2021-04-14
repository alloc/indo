/* tslint:disable:no-console */
import crypto from 'crypto'
import prompt, { Choice } from 'prompts'
import * as os from 'os'
import { relative, resolve } from 'path'
import realpath from 'realpath-native'
import { formatElapsed } from 'misty'
import log from 'shared-log'

export { default as log } from 'shared-log'
export { gray, green, red, yellow, cyan } from 'kleur'
export * from 'misty'
export { startTask } from 'misty/task'
export { crawl, createMatcher } from 'recrawl-sync'

export const time = <T>(label: string, action: () => T) => {
  const start = Date.now()
  const result = action()
  if (result instanceof Promise) {
    result.finally(() => {
      log.debug(label + ':', formatElapsed(start))
    })
  } else {
    log.debug(label + ':', formatElapsed(start))
  }
  return result
}

/** Returns true if `parent` is equal to (or a parent of) the `path` argument */
export const isDescendant = (path: string, parent: string) =>
  path === parent || path.startsWith(parent + '/')

export const getRelativeId = (root: string, path: string) => {
  path = relative(root, resolve(path))
  if (/^\.\//.test(path)) {
    path = path.slice(2)
  }
  return path.replace(/\/$/, '') || '.'
}

export const cwdRelative = (path: string) => {
  return getRelativeId(process.cwd(), path)
}

const NPM_URI_RE = /^(?:(@?[^@]+)@npm:)?(@?[^@]+)(?:@(.+))?$/

// "@foo/bar@*" into { name: "@foo/bar", version: "*" }
// "foo@npm:bar@*" into { alias: "foo", name: "bar", version: "*" }
export const splitNameVersion = (str: string) => {
  const [, alias, name, version] = NPM_URI_RE.exec(str) || []
  return { alias, name, version }
}

export const getRealPath = (path: string) => {
  try {
    return realpath.sync(path)
  } catch {
    return path
  }
}

export const isPathEqual = (a: string, b: string) =>
  getRealPath(a) === getRealPath(b)

export const isHomeDir = (path: string) => {
  return path === '/' || path === os.homedir()
}

export const tildify = (path: string) => {
  const home = os.homedir() + '/'
  return path.startsWith(home) ? path.replace(home, '~/') : path
}

export const choose = async <T = string>(
  message: string,
  choices: Choice[],
  initial?: number
): Promise<T> =>
  (
    await prompt({
      type: 'select',
      name: 'result',
      message,
      choices,
      initial,
    })
  ).result

export const confirm = async (message: string): Promise<boolean> =>
  (
    await prompt({
      type: 'confirm',
      name: 'result',
      message,
    })
  ).result

export const randstr = (len: number) => {
  return crypto.randomBytes(len).toString('hex')
}
