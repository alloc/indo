import { loadPackage, PackageMap } from './Package'

/**
 * Load an array of `package.json` paths and deduplicate
 * packages with the same name. Packages earlier in the
 * given array take precedence.
 */
export function loadPackages(
  packagePaths: string[],
  packages: PackageMap = {}
) {
  packagePaths.forEach(pkgPath => {
    const pkg = loadPackage(pkgPath)

    // Ignore unnamed and unversioned packages.
    if (pkg && pkg.name && pkg.version) {
      packages[pkg.name] ??= pkg
    }
  })
  return packages
}
