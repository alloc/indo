import log from 'lodge'
import { join, relative } from 'path'
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
        const target = relative(nodeModulesPath, dep.root)
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
    }
  }
}
