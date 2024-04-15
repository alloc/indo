import { dirname, join, relative, sep } from 'path'
import slurm from 'slurm'
import { fs } from '../core/fs'
import { git } from '../core/git'
import {
  cwdRelative,
  cyan,
  fatal,
  green,
  isPathEqual,
  log,
  success,
  tildify,
  yellow,
} from '../core/helpers'

import { saveConfig, RootConfig } from '../core/config'
import { loadLinkManifest, loadLinkMetaData } from '../core/loadLinkManifest'
import { getNearestPackage } from '../core/getNearestPackage'
import { loadLocalPackages } from '../core/loadLocalPackages'
import { registry } from '../core/registry'
import { indo } from './default'

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
      fatal('Missing config. Did you run', cyan('indo init'), 'yet?')
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
        success(
          'Global package',
          green(name),
          'now points to',
          tildify(pkg.root)
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
      green(name),
      'does not exist. Did you run',
      cyan('indo link'),
      'yet?'
    )
  }
  return join(registry.packageDir, name)
}

type LinkOptions = {
  name: string
  dest?: string
  hard?: boolean
  save?: boolean
}

async function linkGlobalPackage(cfg: RootConfig, opts: LinkOptions) {
  const link = join(cfg.root, opts.dest || join('vendor', opts.name))
  const target = getGlobalPackage(opts.name)

  fs.mkdir(dirname(link))
  if (fs.exists(link)) {
    if (isPathEqual(link, target)) {
      fs.remove(link)
    } else {
      fatal('Path already exists:', green(cwdRelative(link)))
    }
  }

  const packages = loadLocalPackages(cfg)
  if (opts.save) {
    const cwd = process.cwd()
    const pkg = Object.values(packages)
      // Sort by deepest first
      .sort((a, b) => b.root.length - a.root.length)
      .find(pkg => cwd == pkg.root || cwd.startsWith(pkg.root + sep))

    if (!pkg) {
      return fatal(
        'Cannot find package.json in or above current directory:',
        yellow(cwd)
      )
    }

    // Install the package before linking it.
    await pkg.manager.install([opts.name], {
      stdio: 'inherit',
    })
  }

  if (opts.hard) {
    cfg.repos[relative(cfg.root, link)] = {
      url: git.getRemoteUrl(target),
      head: git.getActiveBranch(target),
    }
    saveConfig(cfg)
    success('Updated the "repos" object')

    fs.copy(target, link)
    log(
      green('+'),
      'Created',
      green(cwdRelative(link)),
      'by copying',
      yellow(tildify(target))
    )
  } else {
    fs.link(link, target)
    log(
      green('+'),
      'Linked',
      green(cwdRelative(link)),
      'to',
      yellow(tildify(target))
    )

    // As long as the linked directory is a git repository,
    // its remote branch will be tracked.
    const metadata = loadLinkMetaData(link)
    if (metadata) {
      const links = loadLinkManifest(cfg.root, true)
      links.set(relative(cfg.root, link), metadata)
    }
  }

  await indo(cfg.root, {
    skipInstall: true,
    skipOptional: true,
  })
}
