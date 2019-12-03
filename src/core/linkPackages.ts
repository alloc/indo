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
import { StringMap } from './Package'

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
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
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

          const link = join(nodeModulesPath, alias)
          const target = relative(dirname(link), dep.root)
          if (opts.force || !isPathEqual(link, dep.root)) {
            fs.remove(link, true)
            fs.mkdir(dirname(link))
            fs.link(link, target)
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
