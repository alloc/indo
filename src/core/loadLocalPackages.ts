import { RootConfig } from './config'
import { findLocalPackages } from './findLocalPackages'
import { loadPackages } from './loadPackages'
import { makeCacheFn } from './makeCacheFn'
import { PackageMap } from './Package'

export const FS_PREFIX = '/@fs/'

export function loadLocalPackages(cfg: RootConfig, packages?: PackageMap) {
  return loadPackages(
    makeCacheFn(cfg, findLocalPackages)(cfg),
    packages,
    pkg => pkg.name || FS_PREFIX + pkg.path
  )
}
