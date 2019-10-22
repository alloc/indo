import { splitNameVersion } from './helpers'
import { Package, StringMap } from './Package'

export type InverseDeps = { [name: string]: Package[] }

export function getInverseDeps(packages: Package[]) {
  const inverse: InverseDeps = {}
  for (const pkg of packages) {
    const deps: StringMap = { ...pkg.devDependencies, ...pkg.dependencies }
    for (let [name, version] of Object.entries(deps)) {
      if (/^(file|link):/.test(version)) {
        continue
      }
      if (version.startsWith('npm:')) {
        name = splitNameVersion(version.slice(4)).name
      }
      const links = inverse[name] || (inverse[name] = [])
      links.push(pkg)
    }
  }
  return inverse
}
