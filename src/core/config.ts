import isDeepEqual from 'dequals'
import os from 'os'
import { dirname, join, relative, resolve } from 'path'
import { fs } from './fs'
import { isDescendant, isHomeDir } from './helpers'
import { searchParents } from './searchParents'

export interface RepoConfig {
  url: string
  head?: string
  optional?: boolean
}

interface Config {
  repos: { [path: string]: RepoConfig }
  alias: { [name: string]: string }
  vendor: string[]
  ignore: string[]
}

export interface RootConfig extends Config {
  path: string
  root: string
  parent?: RootConfig
}

/** The basename of an Indo config */
export const dotIndoId = '.indo.json'

export function findConfig(root = process.cwd()) {
  while (true) {
    const configPath = join(root, dotIndoId)
    if (fs.isFile(configPath)) {
      return configPath
    }
    if (isHomeDir(root)) {
      return null
    }
    root = dirname(root)
  }
}

const configCache: { [configPath: string]: RootConfig } = {}

export function loadConfig(configPath = findConfig(), force?: boolean) {
  if (!configPath) return null
  configPath = resolve(configPath)

  let config = configCache[configPath]
  if (config && !force) {
    return config
  }

  let rawConfig: any
  try {
    rawConfig = fs.readJson(configPath)
  } catch (err) {
    if (err.code == fs.NOT_REAL) return null
    throw err
  }

  config = createConfig(rawConfig) as RootConfig
  config.root = dirname(configPath)
  config.path = configPath
  config.parent = getParentConfig(config)
  linkChildConfigs(config)

  configCache[configPath] = config
  return config
}

function getParentConfig({ root }: RootConfig) {
  return searchParents(root, dir => {
    const configPath = join(dir, dotIndoId)
    return configCache[configPath]
  })
}

function linkChildConfigs(parent: RootConfig) {
  for (const configPath in configCache) {
    const config = configCache[configPath]
    if (!isDescendant(config.root, parent.root)) continue
    if (!config.parent || config.parent == parent.parent) {
      config.parent = parent
    }
  }
}

export function createConfig(props?: Partial<Config>): Config {
  return {
    repos: {},
    alias: {},
    vendor: ['vendor/**'],
    ignore: [],
    ...props,
  }
}

export function saveConfig(cfg: RootConfig) {
  const copy = {}
  const empty = createConfig()
  for (const key in cfg) {
    if (key in empty && !isDeepEqual(cfg[key], empty[key])) {
      copy[key] = cfg[key]
    }
  }
  fs.write(cfg.path, JSON.stringify(copy, null, 2))
}

export function loadTopConfig(from: string) {
  const pathComponents = relative(os.homedir(), from).split(/[\\/]/)
  let root = os.homedir()
  for (let i = 0; i < pathComponents.length; i++) {
    if (fs.isFile(join(root, dotIndoId))) break
    root = join(root, pathComponents[i])
    if (root == from) break
  }
  return loadConfig(join(root, dotIndoId))
}
