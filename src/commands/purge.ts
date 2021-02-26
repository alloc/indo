import { dirname, relative, resolve } from 'path'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { fs } from '../core/fs'
import { getInverseDeps } from '../core/getInverseDeps'
import {
  confirm,
  fatal,
  getRelativeId,
  isDescendant,
  log,
} from '../core/helpers'
import { installPackages } from '../core/installAndBuild'
import { loadPackages } from '../core/loadPackages'
import { loadVendors } from '../core/loadVendors'
import { Package } from '../core/Package'

export default async (cfg: RootConfig) => {
  const args = slurm({
    force: true,
    dry: true,
    n: 'dry',
  })
  if (!args.length) {
    throw fatal('Must give one or more package names and/or relative paths')
  }

  const packages = loadPackages(cfg)
  const vendors = loadVendors(cfg)

  // The packages within the deleted root.
  const deleted = new Set<Package>()

  // The indo config has changed.
  let changed = false

  for (let root of args) {
    root = resolve(root)

    const displayName = getRelativeId(process.cwd(), root)
    if (!fs.exists(root)) {
      log.error(`Path named ${log.yellow(displayName)} does not exist`)
      continue
    }

    // Confirm deletion
    if (!args.force) {
      const ok = await confirm(`Delete ${log.yellow(displayName)} forever?`)
      if (!ok) continue
    }

    // Delete from disk
    if (!args.dry) {
      purgeDir(root)
    }

    // Find packages within the deleted root
    for (const pkg of Object.values({ ...packages, ...vendors })) {
      if (isDescendant(pkg.root, root)) {
        deleted.add(pkg)
      }
    }

    const rootId = relative(cfg.root, root)

    // Remove "repos" within the deleted root
    for (const repoDir in cfg.repos) {
      if (isDescendant(repoDir, rootId)) {
        delete cfg.repos[repoDir]
        changed = true
      }
    }

    // Remove "vendor" globs within the deleted root
    cfg.vendor = cfg.vendor.filter(glob => {
      if (isDescendant(glob, rootId)) {
        changed = true
        return false
      }
      return true
    })
  }

  if (deleted.size) {
    // Find packages that depended on any of the deleted packages.
    const parents = new Set<Package>()

    const inverseDeps = getInverseDeps(Object.values(packages))
    for (const pkg of Array.from(deleted)) {
      const links = inverseDeps[pkg.name] || []
      links.forEach(parent => {
        parents.add(parent)
        if (!args.dry) {
          // TODO: remove "node_modules/{alias}" when "npm:" is used
          purgeDir(join(parent.root, 'node_modules', pkg.name))
        }
      })
    }

    if (parents.size) {
      installPackages(Array.from(parents))
    }
  }

  if (changed && !args.dry) {
    saveConfig(cfg)
  }
}

/** Remove the given directory, and any empty parent directories */
function purgeDir(path: string) {
  fs.remove(path, true)
  while (1) {
    path = dirname(path)
    if (fs.list(path).length) break
    fs.remove(path)
  }
}
