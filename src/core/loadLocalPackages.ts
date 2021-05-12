import { RootConfig } from './config'
import { findLocalPackages } from './findLocalPackages'
import { loadPackages } from './loadPackages'
import { makeCacheFn } from './makeCacheFn'
import { PackageMap } from './Package'

export function loadLocalPackages(cfg: RootConfig, packages?: PackageMap) {
  return loadPackages(makeCacheFn(cfg, findLocalPackages)(cfg), packages)
}
