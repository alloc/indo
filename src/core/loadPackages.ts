import { join } from 'path'
import { crawl } from 'recrawl-sync'
import { dotIndoId, loadConfig, RootConfig } from './config'
import { fs } from './fs'
import { GitIgnore } from './gitignore'
import { log } from './helpers'
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

  // Find packages in nested repostories.
  Object.keys(cfg.repos).forEach(repoDir => {
    const absRepoDir = join(cfg.root, repoDir)

    // Nested roots are skipped since they load themselves.
    if (loadConfig(join(absRepoDir, dotIndoId))) return
    // Linked repos are skipped since they are readonly.
    if (fs.isLink(absRepoDir)) return

    // Ensure globs targeting a specific repo can be used.
    const ignore = cfg.ignore.map(glob =>
      glob.startsWith(repoDir + '/') ? glob.slice(repoDir.length + 1) : glob
    )

    findPackages(absRepoDir, ignore).forEach(pkgPath => {
      addPackage(join(repoDir, pkgPath))
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
  log.debug('findPackages:', { root, skip })
  return crawl(root, {
    only: ['**/package.json'],
    skip: ['.git', 'node_modules', ...skip],
    enter: notIgnored,
    filter: notIgnored,
  })
}
