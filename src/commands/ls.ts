import log from 'lodge'
import { relative } from 'path'
import { RootConfig } from '../core/config'
import { loadPackages } from '../core/loadPackages'
import { loadVendors } from '../core/loadVendors'

export default (cfg: RootConfig) => {
  const packages = Object.values({
    ...loadVendors(cfg),
    ...loadPackages(cfg.root, {
      skip: cfg.vendor,
    }),
  })
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
