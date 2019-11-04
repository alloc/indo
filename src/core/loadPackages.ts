import globRegex from 'glob-regex'
import { join } from 'path'
import { crawl } from 'recrawl-sync'
import { RootConfig } from './config'
import { fs } from './fs'
import { GitIgnore } from './gitignore'
import { loadPackage, PackageMap } from './Package'

export function loadPackages(cfg: RootConfig) {
  const packages: PackageMap = {}
  const addPackage = (pkgPath: string) => {
    const pkg = loadPackage(join(cfg.root, pkgPath))!
    if (pkg.name && pkg.version) {
      packages[pkg.name] = pkg
    }
  }

  // Find packages in the root repository.
  findPackages(cfg.root).forEach(addPackage)

  const vendorRE = globRegex(cfg.vendor)

  // Find packages in nested repostories.
  Object.keys(cfg.repos).forEach(repoDir => {
    findPackages(join(cfg.root, repoDir)).forEach(pkgPath => {
      pkgPath = join(repoDir, pkgPath)
      if (!vendorRE.test(pkgPath)) {
        addPackage(pkgPath)
      }
    })
  })

  return packages
}

function findPackages(root: string) {
  if (!fs.isDir(root)) {
    return []
  }
  const gitignore = new GitIgnore(root)
  const notIgnored = (path: string) => {
    return !gitignore.test(join(root, path))
  }
  return crawl(root, {
    only: ['**/package.json'],
    skip: ['.git', 'node_modules'],
    enter: notIgnored,
    filter: notIgnored,
  })
}
