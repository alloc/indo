import { join } from 'path'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { fs } from '../core/fs'
import { getNearestPackage } from '../core/getNearestPackage'
import {
  confirm,
  cyan,
  fatal,
  getRelativeId,
  green,
  isDescendant,
  success,
  warn,
} from '../core/helpers'
import { registry } from '../core/registry'

export default async (cfg: RootConfig | null) => {
  const args = slurm()
  if (args.length) {
    if (!cfg) {
      fatal('Missing config. Please run', cyan('indo init'), 'first')
    }

    const paths = args
      .map(arg => {
        return getRelativeId(process.cwd(), join(cfg.root, 'vendor', arg))
      })
      .filter(path => {
        let target: string
        try {
          target = fs.follow(path)
        } catch {
          warn(`Path named "${path}" does not exist`)
          return false
        }
        if (isDescendant(target, registry.packageDir)) {
          return true
        }
        warn(`Path named "${path}" exists but was not added with \`indo link\``)
        return false
      })

    if (paths.length) {
      process.argv = process.argv.slice(0, 2).concat(paths, '--force')
      await require('./purge').default(cfg)
    }
  } else {
    const pkg = getNearestPackage(process.cwd())
    if (pkg) {
      if (!pkg.name) {
        fatal('Package is missing a "name" field')
      }
      const root = registry.get(pkg.name)
      if (!root) {
        fatal('Global package', green(pkg.name), 'does not exist')
      }
      if (root !== pkg.root) {
        warn(`Global package "${pkg.name}" is linked to "${root}"`)
        const shouldRemove = await confirm('Remove it anyway?')
        if (!shouldRemove) {
          return
        }
      }
      registry.delete(pkg.name)
      success('Global package', green(pkg.name), 'has been unlinked')
    } else {
      fatal('Missing package.json')
    }
  }
}
