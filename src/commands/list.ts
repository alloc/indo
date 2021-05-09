import os from 'os'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { cwdRelative, cyan, gray, log } from '../core/helpers'
import { linkPackages } from '../core/linkPackages'
import { loadAllPackages } from '../core/loadAllPackages'
import { loadPackage, Package, toPackagePath } from '../core/Package'
import { registry } from '../core/registry'

const loadGlobalPackages = () =>
  Object.entries(registry.packages)
    .map(([alias, dir]) => {
      let pkg = loadPackage(toPackagePath(dir))
      if (pkg && alias) {
        pkg = pkg.clone()
        pkg.name = alias
      }
      return pkg as Package
    })
    .filter(Boolean)

export default (cfg: RootConfig) => {
  const args = slurm({ g: true })

  let packages: Package[]
  if (args.g) {
    packages = loadGlobalPackages()
  } else {
    const localPackages = loadAllPackages(cfg)
    linkPackages(cfg, localPackages, { force: true, dryRun: true })
    packages = Object.values(localPackages)
  }

  packages.sort((a, b) => (a.name < b.name ? -1 : 1))

  const unusedPackages: Package[] = []
  if (!args.g) {
    packages = packages.filter(pkg => {
      if (!pkg.localDependents.size) {
        unusedPackages.push(pkg)
        return false
      }
      return true
    })
  }

  for (const pkg of packages) {
    log(
      gray('-'),
      pkg.name,
      pkg.version ? cyan(pkg.version) : '',
      gray(args.g ? pkg.root.replace(os.homedir(), '~') : cwdRelative(pkg.root))
    )
  }

  for (const pkg of unusedPackages) {
    log(
      gray('-'),
      gray(pkg.name),
      pkg.version ? gray(pkg.version) : '',
      gray(args.g ? pkg.root.replace(os.homedir(), '~') : cwdRelative(pkg.root))
    )
  }
}
