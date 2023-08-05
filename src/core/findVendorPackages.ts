import { dirname, join, relative } from 'path'
import { crawl, createMatcher } from 'recrawl-sync'
import { fs } from './fs'
import { RootConfig } from './config'
import { findPackages } from './findPackages'
import { loadPackage, toPackagePath } from './Package'
import { isNodeModules, isSelfManaged } from './helpers'

export function findVendorPackages(cfg: RootConfig) {
  const packagePaths: string[] = []

  // The "ignore" setting affects vendor packages since v0.6
  const skip = createMatcher(cfg.ignore) || (() => false)

  // Note: Only basic globs are supported (eg: "vendor/*" or "app/src/components")
  cfg.vendor.forEach(function findVendors(glob) {
    const isExact = !/[*.?]/.test(glob)
    if (isExact) {
      let exactPath = join(cfg.root, glob)
      if (glob.endsWith('package.json')) {
        return packagePaths.push(exactPath)
      } else {
        exactPath = join(exactPath, 'package.json')
        if (fs.isFile(exactPath)) {
          return packagePaths.push(exactPath)
        }
      }
    }

    let rootId = glob
    while (rootId && rootId.indexOf('*') >= 0) {
      rootId = dirname(rootId)
    }

    const root = join(cfg.root, rootId)
    if (rootId && fs.isDir(root) && !skip(rootId)) {
      glob = glob.slice(rootId.length)
      const only = createMatcher([glob])!
      crawl(root, {
        skip: ['.git'],
        filter: () => false,
        enter(dir) {
          if (!only(dir) || isNodeModules(dir) || skip(dir)) {
            return false
          }
          const pkgPath = toPackagePath(root, dir)
          const pkg = loadPackage(pkgPath)
          if (!pkg) {
            return true
          }
          if (pkg.workspaces) {
            const ws = pkg.workspaces
            const globs = Array.isArray(ws) ? ws : ws.packages
            globs.forEach(glob => {
              findVendors(join(relative(cfg.root, pkg.root), glob))
            })
          } else {
            packagePaths.push(pkgPath)
          }
          return false
        },
      })
    }
  })

  // Treat self-managed repos as vendors.
  Object.keys(cfg.repos).forEach(repoDir => {
    const absRepoDir = join(cfg.root, repoDir)
    if (isSelfManaged(absRepoDir)) {
      // Ensure globs targeting a specific repo can be used.
      const ignore = cfg.ignore.map(glob =>
        glob.startsWith(repoDir + '/') ? glob.slice(repoDir.length) : glob
      )
      findPackages(absRepoDir, ignore).forEach(pkgPath => {
        packagePaths.push(pkgPath)
      })
    }
  })

  return packagePaths
}
