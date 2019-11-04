import findDependency from 'find-dependency'
import { join } from 'path'
import realpath from 'realpath-native'
import { fs } from './fs'
import { log } from './helpers'
import { Package } from './Package'

export type LernaConfig = {
  npmClient?: string
  useWorkspaces?: boolean
}

export function hasLernaConfig(pkg: Package) {
  return !!pkg.lerna || fs.exists(join(pkg.root, 'lerna.json'))
}

export function loadLernaConfig(pkg: Package) {
  let lernaPath = findDependency('lerna', pkg.root)
  if (lernaPath) {
    lernaPath = realpath.sync(lernaPath)

    const loaderPath = findDependency('@lerna/project', lernaPath)
    if (loaderPath) {
      const LernaProject = require(loaderPath)
      const project = new LernaProject(pkg.root)
      return project.config
    }

    log.warn('Failed to find "@lerna/project" from %O', lernaPath)
  } else {
    log.warn('Failed to find "lerna" from %O', pkg.root)
  }
}
