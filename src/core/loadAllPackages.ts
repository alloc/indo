import { RootConfig } from './config'
import { loadLocalPackages } from './loadLocalPackages'
import { loadVendors } from './loadVendors'

export const loadAllPackages = (cfg: RootConfig) => {
  return {
    ...loadVendors(cfg),
    ...loadLocalPackages(cfg),
  }
}
