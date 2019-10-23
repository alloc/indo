import log from 'lodge'
import { join, relative } from 'path'
import fs from 'saxon/sync'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { getNearestPackage } from '../core/getNearestPackage'
import { fatal } from '../core/helpers'
import { registry } from '../core/registry'

export default (cfg: RootConfig | null) => {
  const [name] = slurm()
  if (name) {
    if (cfg) {
      linkGlobalPackage(cfg, name)
    } else {
      fatal('Missing config. Please run', log.lcyan('indo init'), 'first')
    }
  } else {
    // Find the nearest package.json and link it to ~/.indo/packages
    const pkg = getNearestPackage(process.cwd())
    if (pkg) {
      registry.set(pkg.name, pkg.root)
      log(
        log.green('✓'),
        'Global package',
        log.lgreen(pkg.name),
        'now points to',
        log.gray(pkg.root)
      )
    } else {
      fatal('Missing package.json')
    }
  }
}

function linkGlobalPackage(cfg: RootConfig, name: string) {
  const pkgPath = registry.get(name)
  if (!pkgPath) {
    fatal(
      'No package named',
      log.lpink(name),
      'was found. Did you run',
      log.lcyan('indo link'),
      'yet?'
    )
  }
  const link = join(cfg.root, 'vendor', name)
  if (fs.exists(link)) {
    fatal('Path already exists:', log.lpink('./vendor/' + name))
  }
  const target = join(registry.packageDir, name)
  fs.link(link, target)
  log(
    log.green('+'),
    'Linked',
    log.lgreen(relative(cfg.root, link)),
    'to',
    log.lyellow(target)
  )
}
