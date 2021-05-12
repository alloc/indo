import { dirname, relative, resolve } from 'path'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { fs } from '../core/fs'
import {
  confirm,
  fatal,
  getRelativeId,
  green,
  isDescendant,
  log,
  success,
  yellow,
} from '../core/helpers'
import { loadLocalPackages } from '../core/loadLocalPackages'
import { loadVendors } from '../core/loadVendors'
import { Package } from '../core/Package'
import { repairNodeModules } from '../core/repairNodeModules'

export default async (cfg: RootConfig) => {
  const args = slurm({
    force: true,
    dry: true,
    n: 'dry',
  })
  if (!args.length) {
    fatal('Must give one or more package names and/or relative paths')
  }

  const packages = loadLocalPackages(cfg)
  const vendors = loadVendors(cfg)

  // The packages within the deleted root.
  const deleted = new Set<Package>()

  // The indo config has changed.
  let changed = false

  for (let root of args) {
    root = resolve(root)

    const displayName = getRelativeId(process.cwd(), root)
    if (!fs.exists(root)) {
      log.error('Path named', yellow(displayName), 'does not exist')
      continue
    }

    // Confirm deletion
    if (!args.force) {
      const ok = await confirm(`Delete ${yellow(displayName)} forever?`)
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

  if (changed && !args.dry) {
    saveConfig(cfg)
  }

  if (deleted.size) {
    success(
      'Purged',
      green(deleted.size),
      'package' + (deleted.size == 1 ? '' : 's')
    )
    await repairNodeModules(cfg)
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
