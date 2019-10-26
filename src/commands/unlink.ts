import { join } from 'path'
import fs from 'saxon/sync'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { getNearestPackage } from '../core/getNearestPackage'
import {
  confirm,
  fatal,
  getRelativeId,
  isDescendant,
  log,
} from '../core/helpers'
import { registry } from '../core/registry'

export default async (cfg: RootConfig | null) => {
  const args = slurm()
  if (args.length) {
    if (!cfg) {
      throw fatal('Missing config. Please run', log.lcyan('indo init'), 'first')
    }

    const paths = args
      .map(arg => {
        return getRelativeId(process.cwd(), join(cfg.root, 'vendor', arg))
      })
      .filter(path => {
        if (isDescendant(fs.follow(path), registry.packageDir)) {
          return true
        }
        if (fs.exists(path)) {
          log.warn(
            'Path named',
            log.yellow(path),
            'exists but was not added with',
            log.lcyan('indo link')
          )
        } else {
          log.warn('Path named', log.yellow(path), 'does not exist')
        }
        return false
      })

    if (paths.length) {
      process.argv = process.argv.slice(0, 2).concat(paths)
      await require('./purge').default(cfg)
    }
  } else {
    const pkg = getNearestPackage(process.cwd())
    if (pkg) {
      const root = registry.get(pkg.name)
      if (!root) {
        throw fatal('Global package', log.lgreen(pkg.name), 'does not exist')
      }
      if (root !== pkg.root) {
        log.warn(
          'Global package',
          log.lgreen(pkg.name),
          'is linked to',
          log.gray(root)
        )
        const shouldRemove = await confirm('Remove it anyway?')
        if (!shouldRemove) {
          return
        }
      }
      registry.delete(pkg.name)
      log(
        log.green('✓'),
        'Global package',
        log.lgreen(pkg.name),
        'has been unlinked'
      )
    } else {
      fatal('Missing package.json')
    }
  }
}
