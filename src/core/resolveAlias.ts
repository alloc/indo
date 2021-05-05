import { resolve } from 'path'
import { RootConfig } from './config'

export function resolveAlias(
  cfg: RootConfig,
  name: string
): string | undefined {
  // Prefer aliases from higher roots.
  const target =
    (cfg.parent && resolveAlias(cfg.parent, name)) || cfg.alias[name]

  if (target) {
    // The alias can use a relative path.
    if (/^\.\.?(\/|$)/.test(target)) {
      return resolve(cfg.root, target)
    }
    return target
  }
}
