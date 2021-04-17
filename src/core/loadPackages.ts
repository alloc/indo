import globRegex from 'glob-regex'
import { join } from 'path'
import { crawl } from 'recrawl-sync'
import { dotIndoId, loadConfig, RootConfig } from './config'
import { fs } from './fs'
import { GitIgnore } from './gitignore'
import { loadPackage, PackageMap } from './Package'

export function loadPackages(cfg: RootConfig, packages: PackageMap = {}) {
  const addPackage = (pkgPath: string) => {
    const pkg = loadPackage(join(cfg.root, pkgPath))!
    if (pkg.name && pkg.version) {
      // Packages from the root repository take precedence
      // over packages from cloned repos.
      packages[pkg.name] ??= pkg
    }
  }

  // Find packages in the root repository.
  findPackages(cfg.root, cfg.ignore).forEach(addPackage)

  const vendorRE = globRegex(cfg.vendor)

  // Find packages in nested repostories.
  Object.keys(cfg.repos).forEach(repoDir => {
    const absRepoDir = join(cfg.root, repoDir)

    // Nested roots are skipped.
    if (loadConfig(join(absRepoDir, dotIndoId))) return
    // Linked repos are skipped.
    if (fs.isLink(absRepoDir)) return

    findPackages(absRepoDir, cfg.ignore).forEach(pkgPath => {
      // The `repoDir` is intentionally not tested,
      // so cloned repos are always crawled for packages.
      if (!vendorRE.test(pkgPath)) {
        addPackage(join(repoDir, pkgPath))
      }
    })
  })

  return packages
}

function findPackages(root: string, skip: string[]) {
  if (!fs.isDir(root)) {
    return []
  }
  const gitignore = new GitIgnore(root)
  const notIgnored = (path: string) => {
    return !gitignore.test(join(root, path))
  }
  return crawl(root, {
    only: ['**/package.json'],
    skip: ['.git', 'node_modules', ...skip],
    enter: notIgnored,
    filter: notIgnored,
  })
}
