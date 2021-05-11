import { isAbsolute, resolve } from 'path'
import {
  cwdRelative,
  log,
  time,
  green,
  yellow,
  satisfies,
  isNodeModules,
} from './helpers'

import { RootConfig } from './config'
import { loadPackages } from './loadPackages'
import { loadVendors } from './loadVendors'
import { getPackage, loadPackage, Package, toPackagePath } from './Package'
import { findLocalPackages } from './findLocalPackages'
import { resolveAlias } from './resolveAlias'
import { linkPackage } from './linkPackage'
import { eachDependency } from './eachDependency'

export interface VersionError {
  /** The dependent package */
  pkg: Package
  /** The desired version */
  version: string
  /** The unfit dependency */
  dep: Package
}

export function collectVersionErrors() {
  const errors: VersionError[] = []
  log.events.on('version-error', (err: VersionError) => {
    errors.push(err)
    err.toString = () =>
      `Local package ${green(cwdRelative(err.dep.root))} (v${
        err.dep.version
      }) does not satisfy ${yellow(err.version)} required by ${green(
        cwdRelative(err.pkg.root)
      )}`
  })
  return errors
}

export function linkPackages(
  cfg: RootConfig,
  packages = loadPackages(findLocalPackages(cfg)),
  opts: { force?: boolean; dryRun?: boolean } = {}
) {
  const vendor = time('load vendors', () => loadVendors(cfg))
  log.debug(
    'vendor packages:',
    Object.values(vendor).map(pkg => cwdRelative(pkg.root))
  )

  time('link packages', () => {
    for (const pkg of Object.values(packages)) {
      eachDependency(pkg, dep => {
        if (dep.protocol == 'file') return
        if (dep.protocol == 'link') {
          if (isNodeModules(dep.path)) return
          const depPath = resolve(pkg.root, dep.path)
          const depPkg = getPackage(toPackagePath(depPath))
          if (depPkg && depPkg !== pkg) {
            depPkg.localDependents.add(pkg)
            pkg.localDependencies.add(depPkg)
          }
        } else if (dep.name) {
          let name = dep.name
          let depPkg: Package | null | undefined

          const target = resolveAlias(cfg, name)
          if (target) {
            if (isAbsolute(target)) {
              depPkg = loadPackage(toPackagePath(target))!
            } else {
              name = target
            }
          }

          // Vendor packages take precedence, since they might
          // be inherited from higher roots.
          depPkg ||= vendor[name] || packages[name]

          if (depPkg && !opts.dryRun) {
            linkPackage(pkg, depPkg, {
              version: dep.version,
              alias: dep.alias,
              force: opts.force,
            })
          }
        }
      })
    }
  })
}
