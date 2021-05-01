import { loadPackage, Package, PackageMap } from './Package'

/**
 * Load an array of `package.json` paths and deduplicate
 * packages with the same name. Packages earlier in the
 * given array take precedence.
 */
export function loadPackages(
  packagePaths: string[],
  packages: PackageMap = {},
  getName: (pkg: Package) => string | false | null | undefined = pkg => pkg.name
) {
  packagePaths.forEach(pkgPath => {
    const pkg = loadPackage(pkgPath)
    if (pkg) {
      const name = getName(pkg)
      if (name) {
        packages[name] ??= pkg
      }
    }
  })
  return packages
}
