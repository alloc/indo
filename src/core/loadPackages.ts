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
      packages[pkg.name] ??= pkg
    }
  }

  // Find packages in the root repository.
  findPackages(cfg.root, cfg.ignore).forEach(addPackage)

  const vendorRE = globRegex(cfg.vendor)
  const nestedConfigs: RootConfig[] = []

  // Find packages in nested repostories.
  Object.keys(cfg.repos).forEach(repoDir => {
    const absRepoDir = join(cfg.root, repoDir)

    let ignoreRE = vendorRE
    if (vendorRE.test(repoDir)) {
      // Linked repos are skipped.
      if (fs.isLink(absRepoDir)) return
      // Nested configs are recursively handled.
      const cfg = loadConfig(join(absRepoDir, dotIndoId))
      if (cfg) {
        return nestedConfigs.push(cfg)
      }
      // Cloned repos are crawled even if considered a vendor.
      ignoreRE = /^$/
    }

    findPackages(absRepoDir, cfg.ignore).forEach(pkgPath => {
      pkgPath = join(repoDir, pkgPath)
      if (!ignoreRE.test(pkgPath)) {
        addPackage(pkgPath)
      }
    })
  })

  // Nested configs don't inherit our `ignore` array.
  // Duplicate package names are skipped.
  nestedConfigs.forEach(cfg => loadPackages(cfg, packages))

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
