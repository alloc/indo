import { dirname, join, relative, resolve } from 'path'
import semver from 'semver'
import { fs } from './fs'
import {
  cwdRelative,
  isPathEqual,
  log,
  splitNameVersion,
  time,
  cyan,
  gray,
  green,
  yellow,
} from './helpers'

import { RootConfig } from './config'
import { loadPackages } from './loadPackages'
import { loadVendors } from './loadVendors'
import { getPackage, Package, StringMap, toPackagePath } from './Package'
import { findLocalPackages } from './findLocalPackages'

export interface VersionError {
  /** The dependent package */
  pkg: Package
  /** The desired version */
  version: string
  /** The unfit dependency */
  dep: Package
}

export function collectVersionErrors() {
  const errors: VersionError[] = []
  log.events.on('version-error', (err: VersionError) => {
    errors.push(err)
    err.toString = () =>
      `Local package ${green(cwdRelative(err.dep.root))} (v${
        err.dep.version
      }) does not satisfy ${yellow(err.version)} required by ${green(
        cwdRelative(err.pkg.root)
      )}`
  })
  return errors
}

export function linkPackages(
  cfg: RootConfig,
  packages = loadPackages(findLocalPackages(cfg)),
  opts: { force?: boolean } = {}
) {
  const vendor = time('load vendors', () => loadVendors(cfg))
  log.debug(
    'vendor packages:',
    Object.values(vendor).map(pkg => cwdRelative(pkg.root))
  )

  time('link packages', () => {
    for (const pkg of Object.values(packages)) {
      const deps: StringMap = {
        ...pkg.dependencies,
        ...pkg.peerDependencies,
        ...pkg.devDependencies,
      }
      if (!Object.keys(deps).length) {
        continue
      }

      const nodeModulesPath = join(pkg.root, 'node_modules')
      for (let [alias, version] of Object.entries(deps)) {
        if (version.startsWith('file:')) continue
        if (version.startsWith('link:')) {
          if (!version.includes('node_modules')) {
            const depPath = resolve(pkg.root, version.slice(5))
            const dep = getPackage(toPackagePath(depPath))
            if (dep && dep !== pkg) {
              dep.localDependents.add(pkg)
              pkg.localDependencies.add(dep)
            }
          }
          continue
        }

        let name = alias
        if (version.startsWith('npm:')) {
          ;({ name, version } = splitNameVersion(version.slice(4)))
        }
        if (name in cfg.alias) {
          name = cfg.alias[name]
        }

        // Vendor packages take precedence, since they might
        // be inherited from higher roots.
        const dep = vendor[name] || packages[name]
        if (dep) {
          const valid =
            !version ||
            /^(latest|next)$/.test(version) ||
            satisfies(dep.version, version) ||
            /^https?:\/\//.test(version)

          if (!valid) {
            log.events.emit('version-error', { dep, version, pkg })
            continue
          }

          if (dep !== pkg) {
            dep.localDependents.add(pkg)
            pkg.localDependencies.add(dep)
          }

          // If the dependencies were installed with pnpm, we need to
          // update the ".pnpm" cache so "peerDependencies" are linked
          // to the local version.
          const links =
            pkg.manager.name == 'pnpm'
              ? searchPnpmCache(pkg, dep.name, version)
              : []

          // Link to "node_modules/{name}" when not installed by pnpm.
          if (!links.length) {
            links.push(join(nodeModulesPath, alias))
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
              gray(pkg.name + ':') + green(alias),
              'to',
              yellow(cwdRelative(dep.root))
            )
          }

          if (dep.bin) {
            const addBinScript = (name: string, bin: string) => {
              bin = join(dep.root, bin)
              const link = join(nodeModulesPath, '.bin', name)
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
      }
    }
  })
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

function satisfies(version: string, semverRange: string) {
  return semver.satisfies(version, semverRange, { includePrerelease: true })
}
