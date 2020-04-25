import os from 'os'
import { join } from 'path'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { cwdRelative, log } from '../core/helpers'
import { loadAllPackages } from '../core/loadAllPackages'
import { loadPackage, Package } from '../core/Package'
import { registry } from '../core/registry'

const loadGlobalPackages = () =>
  Object.entries(registry.packages)
    .map(([alias, dir]) => {
      let pkg = loadPackage(join(dir, 'package.json'))
      if (pkg && alias) {
        pkg = pkg.clone()
        pkg.name = alias
      }
      return pkg as Package
    })
    .filter(Boolean)

export default (cfg: RootConfig) => {
  const args = slurm({ g: true })

  const packages = args.g
    ? loadGlobalPackages()
    : Object.values(loadAllPackages(cfg))

  packages.sort((a, b) => (a.name < b.name ? -1 : 1))

  for (const pkg of packages) {
    log(
      log.gray('-'),
      pkg.name,
      pkg.version ? log.lcyan(pkg.version) : '',
      log.gray(
        args.g ? pkg.root.replace(os.homedir(), '~') : cwdRelative(pkg.root)
      )
    )
  }
}
