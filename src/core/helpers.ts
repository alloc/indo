import crypto from 'crypto'
import { prompt } from 'enquirer'
import log from 'lodge'
import ora from 'ora'
import * as os from 'os'

export { crawl, createMatcher } from 'recrawl-sync'

export const isHomeDir = (path: string) => {
  return path === '/' || path === os.homedir()
}

export const choose = async <T = string>(
  message: string,
  choices: string[] | Array<{ message: string; value: T }>
) =>
  (await prompt<{ result: T }>({
    type: 'select',
    name: 'result',
    message,
    choices: choices as any,
  })).result

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

export const spin = (text: string) => {
  let spinner = ora(text).start()
  return {
    log(...args: any[]) {
      this.stop()
      log(...args)
      this.start()
    },
    error(...args: any[]) {
      this.stop()
      log.error(...args)
      this.start()
    }
    start(newText?: string) {
      if (newText !== void 0) {
        text = newText
      }
      spinner = ora(text).start()
      return this
    },
    stop() {
      spinner.stop()
      return this
    },
  }
}
