import crypto from 'crypto'
import { prompt } from 'enquirer'
import log from 'lodge'
import * as os from 'os'

export { crawl, createMatcher } from 'recrawl-sync'

export const isHomeDir = (path: string) => {
  return path === '/' || path === os.homedir()
}

export const confirm = async (message: string) =>
  (await prompt<{ result: boolean }>({
    type: 'confirm',
    name: 'result',
    message,
  })).result

export const fatal = (...args: any[]) => {
  log.error(...args)
  process.exit(1)
}

export const randstr = (len: number) => {
  return crypto.randomBytes(len).toString('hex')
}
