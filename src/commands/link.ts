import { dirname, join, relative } from 'path'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { fs } from '../core/fs'
import { getNearestPackage } from '../core/getNearestPackage'
import { git } from '../core/git'
import { cwdRelative, fatal, isPathEqual, log, tildify } from '../core/helpers'
import { linkPackages } from '../core/linkPackages'
import { registry } from '../core/registry'

export default (cfg: RootConfig | null) => {
  const args = slurm({
    g: true,
    o: true,
    hard: {
      type: 'boolean',
    },
  })

  const name = args[0]
  if (name) {
    if (!cfg) {
      fatal('Missing config. Did you run', log.lcyan('indo init'), 'yet?')
      return
    }
    if (!args.g) {
      linkGlobalPackage(cfg, { name, dest: args.o, hard: args.hard })
      return
    }
  }

  if (!args.length || args.g) {
    // Find the nearest package.json and link it to ~/.indo/packages
    const pkg = getNearestPackage(process.cwd())
    if (pkg) {
      if (name == null) {
        name = pkg.name
      }
      if (name) {
        registry.set(name, pkg.root)
        log(
          log.green('✓'),
          'Global package',
          log.lgreen(name),
          'now points to',
          log.gray(tildify(pkg.root))
        )
      } else {
        fatal('Missing package name (-g)')
      }
    } else {
      fatal('Missing package.json')
    }
  }
}

function getGlobalPackage(name: string) {
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
  return pkgPath!
}

function linkGlobalPackage(
  cfg: RootConfig,
  opts: { name: string; dest?: string; hard?: boolean }
) {
  const link = join(cfg.root, opts.dest || join('vendor', opts.name))
  const target = getGlobalPackage(opts.name)

  fs.mkdir(dirname(link))
  if (fs.exists(link)) {
    if (isPathEqual(link, target)) {
      fs.remove(link)
    } else {
      fatal('Path already exists:', log.lgreen(cwdRelative(link)))
    }
  }

  if (opts.hard) {
    fs.copy(target, link)
    cfg.repos[relative(cfg.root, link)] = {
      url: git.getRemoteUrl(link),
      head: git.getActiveBranch(link),
    }
    saveConfig(cfg)
    log(log.green('✓'), 'Updated the "repos" object')
  } else {
    fs.link(link, target)
  }
  log(
    log.green('+'),
    opts.hard ? 'Copied' : 'Linked',
    log.lgreen(cwdRelative(link)),
    'to',
    log.lyellow(tildify(target))
  )

  linkPackages(cfg)
}
