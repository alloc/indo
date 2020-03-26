import { dirname, join, relative } from 'path'
import semver from 'semver'
import { RootConfig } from './config'
import { fs } from './fs'
import {
  cwdRelative,
  isPathEqual,
  log,
  splitNameVersion,
  time,
} from './helpers'
import { loadPackages } from './loadPackages'
import { loadVendors } from './loadVendors'
import { Package, StringMap } from './Package'

export function linkPackages(
  cfg: RootConfig,
  packages = loadPackages(cfg),
  opts: { force?: boolean } = {}
) {
  const vendor = time('load vendors', () => loadVendors(cfg))

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
        if (/^(link|file):/.test(version)) continue

        let name = alias
        if (version.startsWith('npm:')) {
          ;({ name, version } = splitNameVersion(version.slice(4)))
        }
        if (name in cfg.alias) {
          name = cfg.alias[name]
        }

        const dep = packages[name] || vendor[name]
        if (dep) {
          const valid =
            !version ||
            semver.satisfies(dep.version, version, {
              includePrerelease: true,
            })

          if (!valid) {
            log.warn(
              'Local package',
              log.lgreen(cwdRelative(dep.root)),
              `(v${dep.version})`,
              'does not satisfy',
              log.yellow(version),
              'required by',
              log.lgreen(cwdRelative(pkg.root))
            )
            continue
          }

          // If the dependencies were installed with pnpm, we need to
          // update the ".pnpm" cache so "peerDependencies" are linked
          // to the local version.
          const links =
            pkg.manager.name == 'pnpm'
              ? searchPnpmCache(pkg, dep.name, version)
              : [join(nodeModulesPath, alias)]

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
              log.green('+'),
              'Linked',
              log.gray(pkg.name + ':') + log.lgreen(alias),
              'to',
              log.lyellow(cwdRelative(dep.root))
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
                  log.green('+'),
                  'Linked',
                  log.gray(pkg.name + ':') + log.lcyan(name),
                  'to',
                  log.lyellow(cwdRelative(bin))
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

    log(log.green('✓'), 'Local packages are linked!')
  })
}

function searchPnpmCache(pkg: Package, name: string, semverRange: string) {
  const paths: string[] = []

  const cacheDir = join(pkg.root, 'node_modules', '.pnpm')
  if (fs.exists(cacheDir)) {
    const registries = fs
      .list(cacheDir)
      .filter(name => /^(\..+|.+\.yaml|node_modules)$/.test(name) == false)

    for (const registry of registries) {
      const versionDir = join(cacheDir, registry, name)
      if (!fs.exists(versionDir)) {
        continue
      }
      for (let versionHash of fs.list(versionDir)) {
        const version = versionHash.replace(/_.+$/, '')
        if (semver.satisfies(version, semverRange)) {
          paths.push(join(versionDir, versionHash, 'node_modules', name))
        }
      }
    }
  }

  return paths
}
