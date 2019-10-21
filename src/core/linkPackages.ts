import log from 'lodge'
import { join, relative } from 'path'
import fs from 'saxon/sync'
import semver from 'semver'
import { RootConfig } from './config'
import { loadVendors } from './loadVendors'
import { PackageMap } from './Package'

export function linkPackages(cfg: RootConfig, packages: PackageMap) {
  const vendor = loadVendors(cfg)
  for (const pkg of Object.values(packages)) {
    if (!pkg.dependencies) {
      continue
    }

    const nodeModulesPath = join(pkg.root, 'node_modules')
    for (let [name, version] of Object.entries(pkg.dependencies)) {
      if (/^(link|file):/.test(version)) continue

      const alias = cfg.alias[name] || name
      if (version.startsWith('npm:')) {
        ;[name, version] = version.slice(4).split('@')
      }

      // TODO: compare semver
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
          log.gray(pkg.name + ':') + log.green(alias),
          'to',
          log.lcyan('./' + relative(cfg.root, dep.root))
        )
      }
    }
  }
}
