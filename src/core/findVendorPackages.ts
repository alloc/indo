import { dirname, join, relative } from 'path'
import { crawl, createMatcher } from 'recrawl-sync'
import { fs } from './fs'
import { RootConfig } from './config'
import { loadPackage, toPackagePath } from './Package'

const NODE_MODULES = /(^|\/)node_modules$/

export function findVendorPackages(cfg: RootConfig) {
  const packagePaths: string[] = []

  // The "ignore" setting affects vendor packages since v0.6
  const skip = createMatcher(cfg.ignore) || (() => false)

  // Note: Only basic globs are supported (eg: "vendor/*" or "app/src/components")
  cfg.vendor.forEach(function findVendors(glob) {
    const isExact = !/[*.?]/.test(glob)
    if (isExact) {
      return packagePaths.push(join(cfg.root, glob))
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
        filter: () => false,
        enter(dir) {
          if (!only(dir) || NODE_MODULES.test(dir) || skip(dir)) {
            return false
          }
          const pkgPath = toPackagePath(cfg.root, rootId, dir)
          packagePaths.push(pkgPath)
          const pkg = loadPackage(pkgPath)
          if (!pkg) {
            return true
          }
          if (pkg.workspaces) {
            const ws = pkg.workspaces
            const globs = Array.isArray(ws) ? ws : ws.packages
            globs.forEach(glob => {
              findVendors(join(relative(cfg.root, pkg!.root), glob))
            })
          }
          return false
        },
      })
    }
  })

  return packagePaths
}
