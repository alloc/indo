import { relative } from 'path'
import { RootConfig } from '../core/config'
import { log } from '../core/helpers'
import { loadAllPackages } from '../core/loadAllPackages'

export default (cfg: RootConfig) => {
  const packages = Object.values(loadAllPackages(cfg))
  packages.sort((a, b) => (a.name < b.name ? -1 : 1))
  for (const pkg of packages) {
    log(
      log.gray('-'),
      pkg.name,
      pkg.version ? log.lcyan(pkg.version) : '',
      log.gray('./' + relative(cfg.root, pkg.root))
    )
  }
}
