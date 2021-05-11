import { dirname, join, relative } from 'path'
import { Package } from './Package'
import { fs } from './fs'
import {
  cwdRelative,
  isPathEqual,
  log,
  cyan,
  gray,
  green,
  yellow,
  satisfies,
} from './helpers'

interface Options {
  /** Link the dependency even if it already exists */
  force?: boolean
  /** The semver range for validating this dependency */
  version?: string
  /** Use an alias instead of `dep.name` when logging */
  alias?: string
}

/** Check if a package is compatible with a given version range. */
export function isLinkable(dep: Package, version: string | undefined) {
  return (
    !version ||
    /^(latest|next)$/.test(version) ||
    satisfies(dep.version, version) ||
    /^https?:\/\//.test(version)
  )
}

export function linkPackage(pkg: Package, dep: Package, opts: Options = {}) {
  // If no version is given, chop off the patch bit for
  // the `searchPnpmCache` call.
  const version =
    opts.version || '~' + dep.version.replace(/\.[0-9]+(-.+)?$/, '.0$1')

  if (!isLinkable(dep, version)) {
    return log.events.emit('version-error', {
      dep,
      version,
      pkg,
    })
  }

  if (dep !== pkg) {
    dep.localDependents.add(pkg)
    pkg.localDependencies.add(dep)
  }

  // If the dependencies were installed with pnpm, we need to
  // update the ".pnpm" cache so "peerDependencies" are linked
  // to the local version.
  const links =
    pkg.manager.name == 'pnpm' ? searchPnpmCache(pkg, dep.name, version) : []

  // Link to "node_modules/{name}" when not installed by pnpm.
  if (!links.length) {
    links.push(join(pkg.root, 'node_modules'))
  }

  let linked = false
  for (const link of links) {
    if (opts.force || !isPathEqual(link, dep.root)) {
      fs.remove(link, true)
      fs.mkdir(dirname(link))

      const target = relative(dirname(link), dep.root)
      fs.link(link, target)
      linked = true
    }
  }

  if (linked) {
    log(
      green('+'),
      'Linked',
      gray(pkg.name + ':') + green(opts.alias || dep.name),
      'to',
      yellow(cwdRelative(dep.root))
    )
  }

  if (dep.bin) {
    const addBinScript = (name: string, bin: string) => {
      bin = join(dep.root, bin)
      const link = join(pkg.root, 'node_modules/.bin', name)
      const target = relative(dirname(link), bin)
      if (opts.force || !isPathEqual(link, bin)) {
        fs.remove(link)
        fs.mkdir(dirname(link))
        fs.link(link, target)
        log(
          green('+'),
          'Linked',
          gray(pkg.name + ':') + cyan(name),
          'to',
          yellow(cwdRelative(bin))
        )
      }
    }
    if (typeof dep.bin == 'string') {
      addBinScript(dep.name, dep.bin)
    } else {
      for (const name in dep.bin) {
        addBinScript(name, dep.bin[name])
      }
    }
  }
}

function searchPnpmCache(pkg: Package, name: string, semverRange: string) {
  const paths: string[] = []

  const cacheDir = join(pkg.root, 'node_modules', '.pnpm')
  if (fs.exists(cacheDir)) {
    // Before pnpm v5, packages are stored as `${registry}/${name}/${version}`
    if (fs.exists(join(cacheDir, 'registry.npmjs.org'))) {
      const registries = fs
        .list(cacheDir)
        .filter(file => /^(\..+|.+\.yaml|node_modules)$/.test(file) == false)

      // Replace any cached package whose version is compatible w/ the local version.
      for (const registry of registries) {
        const versionDir = join(cacheDir, registry, name)
        if (!fs.exists(versionDir)) {
          continue
        }
        for (let versionHash of fs.list(versionDir)) {
          const version = versionHash.replace(/_.+$/, '')
          if (satisfies(version, semverRange)) {
            paths.push(join(versionDir, versionHash, 'node_modules', name))
          }
        }
      }
    }
    // In pnpm v5, packages are stored as `${name}@${version}`
    else {
      const scope = name[0] == '@' ? name.split('/')[0] : ''
      const scopeDir = join(cacheDir, scope)
      if (fs.exists(scopeDir)) {
        for (let cacheId of fs.list(scopeDir)) {
          cacheId = join(scope, cacheId)
          if (cacheId.startsWith(name + '@')) {
            const versionRegex = /(?:@[^_]+\/)?[^_]+@([^_]+)(?:_.+)?/
            const [, version] = versionRegex.exec(cacheId)!
            if (satisfies(version, semverRange)) {
              paths.push(join(cacheDir, cacheId, 'node_modules', name))
            }
          }
        }
      }
    }
  }

  return paths
}
