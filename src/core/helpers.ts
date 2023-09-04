/* tslint:disable:no-console */
import crypto from 'crypto'
import prompt, { Choice } from 'prompts'
import semver from 'semver'
import * as os from 'os'
import { join, relative, resolve } from 'path'
import realpath from 'realpath-native'
import { formatElapsed } from 'misty'
import { gray } from 'kleur'
import log from 'shared-log'
import { dotIndoId, loadConfig } from './config'
import { fs } from './fs'

export { default as log } from 'shared-log'
export { gray, green, red, yellow, cyan } from 'kleur'
export * from 'misty'
export { startTask } from 'misty/task'
export { crawl, createMatcher } from 'recrawl-sync'

/** Cached metadata is kept here. */
export const CACHE_DIR = '.git/.indo'

export const time = <T>(label: string, action: () => T) => {
  const start = Date.now()
  const result = action()
  if (result instanceof Promise) {
    result.finally(() => {
      log.debug(gray(label + ': ' + formatElapsed(start)))
    })
  } else {
    log.debug(gray(label + ': ' + formatElapsed(start)))
  }
  return result
}

/**
 * Returns `true` if the given directory should __not__ be managed
 * by `indo` from a higher directory.
 */
export function isSelfManaged(absRepoDir: string) {
  // Linked repos are readonly.
  if (fs.isLink(absRepoDir)) return true
  // Nested roots are managed explicitly.
  return !!loadConfig(join(absRepoDir, dotIndoId))
}

/** Returns true if `parent` is equal to (or a parent of) the `path` argument */
export const isDescendant = (path: string, parent: string) =>
  path === parent || path.startsWith(parent + '/')

export const getRelativeId = (root: string, path: string) =>
  relative(root, resolve(path)) || '.'

export const cwdRelative = (path: string) => {
  path = getRelativeId(process.cwd(), path)
  return path.endsWith('.')
    ? path + '/'
    : path.startsWith('../')
    ? path
    : './' + path
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

const NODE_MODULES_RE = /(^|\/)node_modules(\/|$)/

export const isNodeModules = (path: string) => {
  return NODE_MODULES_RE.test(path)
}

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

export const isVersionInRange = (version: string, semverRange: string) =>
  semver.satisfies(version, semverRange, { includePrerelease: true })
