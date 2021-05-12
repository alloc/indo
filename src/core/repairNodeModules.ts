import { join } from 'path'
import { RootConfig } from './config'
import { installPackages } from './installPackages'
import { loadLocalPackages } from './loadLocalPackages'
import { Package } from './Package'
import { fs } from './fs'

export function repairNodeModules(
  cfg: RootConfig,
  packages = loadLocalPackages(cfg)
) {
  const repairQueue: Package[] = []
  for (const pkg of Object.values(packages)) {
    const nodeModulesDir = join(pkg.root, 'node_modules')
    if (!fs.exists(nodeModulesDir)) {
      repairQueue.push(pkg)
      continue
    }
    const { dependencies: deps, devDependencies: devDeps } = pkg
    const brokenLinks: string[] = []
    for (const name in { ...deps, ...devDeps }) {
      const depPath = join(nodeModulesDir, name)
      if (isBrokenLink(depPath)) {
        brokenLinks.push(depPath)
        removeLink(depPath)
      }
    }
    if (brokenLinks.length) {
      repairQueue.push(pkg)
    }
  }
  return installPackages(repairQueue, true)
}

function isBrokenLink(path: string) {
  try {
    fs.follow(path, true)
  } catch {
    return true
  }
}

function removeLink(linkPath: string) {
  // Remove link from node_modules/.pnpm
  try {
    const target = fs.follow(linkPath)
    if (target.includes('.pnpm')) {
      fs.remove(target)
    }
  } catch {}

  // Remove link from node_modules
  fs.remove(linkPath)
}
