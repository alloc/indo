import { dirname, join, relative, sep } from 'path'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { fs } from '../core/fs'
import { getNearestPackage } from '../core/getNearestPackage'
import { git } from '../core/git'
import { cwdRelative, fatal, isPathEqual, log, tildify } from '../core/helpers'
import { linkPackages } from '../core/linkPackages'
import { loadPackages } from '../core/loadPackages'
import { registry } from '../core/registry'

export default (cfg: RootConfig | null) => {
  const args = slurm({
    g: true,
    o: true,
    s: { type: 'boolean' },
    hard: { type: 'boolean' },
  })

  const name = args[0]
  if (name) {
    if (!cfg) {
      fatal('Missing config. Did you run', log.lcyan('indo init'), 'yet?')
      return
    }
    if (!args.g) {
      return linkGlobalPackage(cfg, {
        name,
        dest: args.o,
        hard: args.hard,
        save: args.s,
      })
    }
  }

  if (!args.length || args.g) {
    // Find the nearest package.json and link it to ~/.indo/packages
    const pkg = getNearestPackage(process.cwd())
    if (pkg) {
      const name = args[0] || args.g || pkg.name
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

type LinkOptions = {
  name: string
  dest?: string
  hard?: boolean
  save?: boolean
}

function linkGlobalPackage(cfg: RootConfig, opts: LinkOptions) {
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

  const packages = loadPackages(cfg)
  if (opts.save) {
    const cwd = process.cwd()
    const pkg = Object.values(packages)
      // Sort by deepest first
      .sort((a, b) => b.root.length - a.root.length)
      .find(pkg => cwd == pkg.root || cwd.startsWith(pkg.root + sep))

    if (!pkg) {
      return fatal(
        'Cannot find package.json in or above current directory:',
        log.lyellow(cwd)
      )
    }

    // Install the package before linking it.
    pkg.manager.install([opts.name])
  }

  if (opts.hard) {
    cfg.repos[relative(cfg.root, link)] = {
      url: git.getRemoteUrl(target),
      head: git.getActiveBranch(target),
    }
    saveConfig(cfg)
    log(log.green('✓'), 'Updated the "repos" object')

    fs.copy(target, link)
    log(
      log.green('+'),
      'Created',
      log.lgreen(cwdRelative(link)),
      'by copying',
      log.lyellow(tildify(target))
    )
  } else {
    fs.link(link, target)
    log(
      log.green('+'),
      'Linked',
      log.lgreen(cwdRelative(link)),
      'to',
      log.lyellow(tildify(target))
    )
  }

  linkPackages(cfg, packages)
}
