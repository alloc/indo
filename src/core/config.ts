import isDeepEqual from 'dequals'
import { dirname, join } from 'path'
import { fs } from './fs'
import { isHomeDir, time } from './helpers'

export interface RepoConfig {
  url: string
  head?: string
}

interface Config {
  repos: { [path: string]: RepoConfig }
  alias: { [name: string]: string }
  vendor: string[]
}

export interface RootConfig extends Config {
  path: string
  root: string
}

export const loadConfig = (root = process.cwd()) =>
  time('load config', () => {
    while (true) {
      const configPath = join(root, '.indo.json')
      if (fs.isFile(configPath)) {
        const config = createConfig(fs.readJson(configPath))
        return Object.defineProperties(config, {
          path: { value: configPath },
          root: { value: root },
        }) as RootConfig
      }
      if (isHomeDir(root)) {
        return null
      }
      root = dirname(root)
    }
  })

export function createConfig(props?: Partial<Config>): Config {
  return {
    repos: {},
    alias: {},
    vendor: ['vendor/**'],
    ...props,
  }
}

export function saveConfig(cfg: RootConfig) {
  const copy = {}
  const empty = createConfig()
  for (const key in empty) {
    if (!isDeepEqual(cfg[key], empty[key])) {
      copy[key] = cfg[key]
    }
  }
  fs.write(cfg.path, JSON.stringify(copy, null, 2))
}
