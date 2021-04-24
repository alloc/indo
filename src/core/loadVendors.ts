import { RootConfig } from './config'
import { PackageMap } from './Package'
import { loadPackages } from './loadPackages'
import { findLocalPackages } from './findLocalPackages'
import { findVendorPackages } from './findVendorPackages'

/**
 * Find vendor packages for the given `.indo.json` root and in
 * ancestor indo roots. The higher packages take precedence.
 */
export function loadVendors(cfg: RootConfig, packages: PackageMap = {}) {
  if (cfg.parent) {
    loadAncestorPackages(cfg.parent, findLocalPackages, packages)
  }
  loadAncestorPackages(cfg, findVendorPackages, packages)
  return packages
}

/**
 * Find packages in every indo root above and including the given
 * indo root and load the packages, starting from the highest root.
 */
function loadAncestorPackages(
  cfg: RootConfig,
  findPackages: (cfg: RootConfig) => string[],
  packages: PackageMap
) {
  if (cfg.parent) {
    loadAncestorPackages(cfg.parent, findPackages, packages)
  }
  loadPackages(findPackages(cfg), packages)
}
