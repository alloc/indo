import log from 'lodge'
import { dirname, join, relative } from 'path'
import realpath from 'realpath-native'
import fs from 'saxon/sync'
import semver from 'semver'
import { RootConfig } from './config'
import { splitNameVersion } from './helpers'
import { loadVendors } from './loadVendors'
import { PackageMap, StringMap } from './Package'

export function linkPackages(cfg: RootConfig, packages: PackageMap) {
  const vendor = loadVendors(cfg)
  for (const pkg of Object.values(packages)) {
    const deps: StringMap = { ...pkg.dependencies, ...pkg.devDependencies }
    if (!Object.keys(deps).length) {
      continue
    }

    const nodeModulesPath = join(pkg.root, 'node_modules')
    for (let [name, version] of Object.entries(deps)) {
      if (/^(link|file):/.test(version)) continue

      const alias = cfg.alias[name] || name
      if (version.startsWith('npm:')) {
        ;({ name, version } = splitNameVersion(version.slice(4)))
      }

      const dep = packages[name] || vendor[name]
      if (dep) {
        if (version && !semver.satisfies(dep.version, version)) {
          log.warn(
            'Local package',
            log.lgreen('./' + relative(cfg.root, dep.root)),
            `(v${dep.version})`,
            'does not satisfy',
            log.yellow(version),
            'required by',
            log.lgreen('./' + relative(cfg.root, pkg.root))
          )
          continue
        }
        const link = join(nodeModulesPath, alias)
        const target = relative(dirname(link), dep.root)
        if (realpath.sync(link) !== realpath.sync(dep.root)) {
          fs.remove(link)
          fs.link(link, target)
          log(
            log.green('+'),
            'Linked',
            log.gray(pkg.name + ':') + log.lgreen(alias),
            'to',
            log.lyellow('./' + relative(cfg.root, dep.root))
          )
        }
        if (dep.bin) {
          const addBinScript = (name: string, bin: string) => {
            bin = join(dep.root, bin)
            const link = join(nodeModulesPath, '.bin', name)
            const target = relative(dirname(link), bin)
            if (realpath.sync(link) !== realpath.sync(bin)) {
              fs.remove(link)
              fs.link(link, target)
              log(
                log.green('+'),
                'Linked',
                log.gray(pkg.name + ':') + log.lcyan(name),
                'to',
                log.lyellow('./' + relative(cfg.root, bin))
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
}
