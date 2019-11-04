import { join } from 'path'
import { crawl } from 'recrawl-sync'
import { RootConfig } from './config'
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
  return packages
}

function findPackages(root: string) {
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
