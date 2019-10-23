import log from 'lodge'
import { join, relative } from 'path'
import realpath from 'realpath-native'
import fs from 'saxon/sync'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { getNearestPackage } from '../core/getNearestPackage'
import { fatal, tildify } from '../core/helpers'
import { registry } from '../core/registry'

export default (cfg: RootConfig | null) => {
  const [name] = slurm()
  if (name) {
    if (cfg) {
      linkGlobalPackage(cfg, name)
    } else {
      fatal('Missing config. Did you run', log.lcyan('indo init'), 'yet?')
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
        log.gray(tildify(pkg.root))
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
      'Global package',
      log.lgreen(name),
      'does not exist. Did you run',
      log.lcyan('indo link'),
      'yet?'
    )
  }
  const link = join(cfg.root, 'vendor', name)
  const target = join(registry.packageDir, name)
  if (fs.exists(link)) {
    if (realpath.sync(link) !== realpath.sync(target)) {
      fatal('Path already exists:', log.lgreen('./vendor/' + name))
    } else {
      fs.remove(link)
    }
  }
  fs.link(link, target)
  log(
    log.green('+'),
    'Linked',
    log.lgreen('./' + relative(cfg.root, link)),
    'to',
    log.lyellow(tildify(target))
  )
}
