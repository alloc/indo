import AsyncTaskGroup from 'async-task-group'
import { join, relative, resolve } from 'path'
import fs from 'saxon/sync'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { getInverseDeps } from '../core/getInverseDeps'
import {
  confirm,
  createMatcher,
  fatal,
  getRelativeId,
  isDescendant,
  log,
  spin,
} from '../core/helpers'
import { loadPackages } from '../core/loadPackages'
import { loadVendors } from '../core/loadVendors'
import { loadPackage, Package } from '../core/Package'

export default async (cfg: RootConfig) => {
  const args = slurm({
    dry: true,
    n: 'dry',
  })
  if (!args.length) {
    throw fatal('Must give one or more package names and/or relative paths')
  }

  const packages = loadPackages(cfg.root, { skip: cfg.vendor })
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
    const ok = await confirm(`Delete ${log.yellow(displayName)} forever?`)
    if (!ok) continue

    // Delete from disk
    if (!args.dry) {
      fs.remove(root, true)
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
        // TODO: remove "node_modules/{alias}" when "npm:" is used
        fs.remove(join(parent.root, 'node_modules', pkg.name))
        parents.add(parent)
      })
    }

    if (parents.size) {
      const spinner = spin('Installing dependencies...')
      const installer = new AsyncTaskGroup(3)
      await installer.map(Array.from(parents), async (pkg: Package) => {
        try {
          await pkg.manager.install()
          spinner.log(
            log.green('✓'),
            'Installed',
            log.green('./' + relative(cfg.root, pkg.root)),
            'dependencies using',
            log.lcyan(pkg.manager.name)
          )
        } catch {
          spinner.log(
            log.red('⨯'),
            'Failed to install dependencies of',
            log.lyellow(relative(cfg.root, pkg.root))
          )
        }
      })
      spinner.stop()
    }
  }

  if (changed && !args.dry) {
    saveConfig(cfg)
  }
}
