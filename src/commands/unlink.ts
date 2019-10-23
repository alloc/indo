import log from 'lodge'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { getNearestPackage } from '../core/getNearestPackage'
import { fatal } from '../core/helpers'
import { registry } from '../core/registry'

export default (cfg: RootConfig | null) => {
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
      if (pkg.root == registry.get(pkg.name)) {
        registry.delete(pkg.name)
      } else {
        fatal('This package is not linked')
      }
    } else {
      fatal('Missing package.json')
    }
  }
}
