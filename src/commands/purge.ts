import { dirname, join, relative, resolve } from 'path'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { fs } from '../core/fs'
import { getInverseDeps } from '../core/getInverseDeps'
import {
  confirm,
  createMatcher,
  fatal,
  getRelativeId,
  isDescendant,
  log,
} from '../core/helpers'
import { installPackages } from '../core/installAndBuild'
import { loadPackages } from '../core/loadPackages'
import { loadVendors } from '../core/loadVendors'
import { loadPackage, Package } from '../core/Package'

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

  const deleted = new Set<Package>()
  const onDelete = (dir: string) => {
    const pkgPath = join(cfg.root, dir, 'package.json')
    const pkg = loadPackage(pkgPath)
    if (pkg) deleted.add(pkg)
  }

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

    const rootId = relative(cfg.root, root)

    // Delete descendants from "repos"
    for (const repoDir in cfg.repos) {
      if (isDescendant(repoDir, rootId)) {
        delete cfg.repos[repoDir]
        onDelete(repoDir)
        changed = true
      }
    }

    // Delete descendants from "vendor"
    cfg.vendor = cfg.vendor.filter(glob => {
      if (isDescendant(glob, rootId)) {
        const match = createMatcher([glob])!
        for (const dep of Object.values(vendors)) {
          const depDir = relative(cfg.root, dep.root)
          if (match(depDir)) onDelete(depDir)
        }
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
