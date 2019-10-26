import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { getNearestPackage } from '../core/getNearestPackage'
import { confirm, fatal, log } from '../core/helpers'
import { registry } from '../core/registry'

export default async (cfg: RootConfig | null) => {
  const args = slurm()
  if (args.length) {
    if (cfg) {
      require('./rm').default(cfg)
    } else {
      fatal('Missing config. Please run', log.lcyan('indo init'), 'first')
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
