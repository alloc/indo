import { RootConfig } from './config'
import { loadPackages } from './loadPackages'
import { loadVendors } from './loadVendors'

export const loadAllPackages = (cfg: RootConfig) => {
  return {
    ...loadVendors(cfg),
    ...loadPackages(cfg),
  }
}
