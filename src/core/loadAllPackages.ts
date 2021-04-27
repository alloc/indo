import { RootConfig } from './config'
import { findLocalPackages } from './findLocalPackages'
import { loadPackages } from './loadPackages'
import { loadVendors } from './loadVendors'

export const loadAllPackages = (cfg: RootConfig) => {
  return {
    ...loadVendors(cfg),
    ...loadPackages(findLocalPackages(cfg)),
  }
}
