import { splitNameVersion } from './helpers'
import { Package, StringMap } from './Package'

export type Dependency = NpmDependency | LocalDependency

export interface LocalDependency {
  alias: string
  path: string
  protocol: 'file' | 'link'
  name?: undefined
  version?: undefined
}

export interface NpmDependency {
  name: string
  version: string
  alias: string
  protocol?: undefined
}

export function eachDependency(
  pkg: Package,
  onDependency: (dep: Dependency) => void
) {
  const deps: StringMap = {
    ...pkg.dependencies,
    ...pkg.peerDependencies,
    ...pkg.devDependencies,
  }
  if (Object.keys(deps).length)
    for (let [alias, spec] of Object.entries(deps)) {
      if (spec.startsWith('npm:')) {
        const { name, version } = splitNameVersion(spec.slice(4))
        onDependency({
          name,
          version,
          alias,
        })
      } else if (/^[a-z]+:/.test(spec)) {
        const protocol = spec.slice(0, spec.indexOf(':'))
        if (protocol != 'file' && protocol != 'link') {
          continue // TODO: support other protocols
        }
        onDependency({
          alias,
          path: spec.slice(5),
          protocol,
        })
      } else {
        if (spec.includes('/')) {
          continue // TODO: handle git urls
        }
        onDependency({
          name: alias,
          version: spec,
          alias,
        })
      }
    }
}
