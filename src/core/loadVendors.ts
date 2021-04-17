import { dirname, join, relative } from 'path'
import { crawl, createMatcher } from 'recrawl-sync'
import { fs } from './fs'
import { RootConfig } from './config'
import { loadPackage, PackageMap } from './Package'
import { loadPackages } from './loadPackages'

const NODE_MODULES = /\/node_modules$/

export function loadVendors(cfg: RootConfig, packages: PackageMap = {}) {
  const addPackage = (dir: string) => {
    const pkgPath = join(cfg.root, dir, 'package.json')
    const pkg = loadPackage(pkgPath)
    if (pkg && pkg.name && pkg.version) {
      // Packages from higher roots take precedence.
      packages[pkg.name] = pkg
    }
    return pkg
  }

  // Note: Only basic globs are supported (eg: "vendor/*" or "app/src/components")
  cfg.vendor.forEach(function findVendors(glob) {
    const isExact = !/[*.?]/.test(glob)
    if (isExact) {
      return addPackage(glob)
    }

    let rootId = glob
    while (rootId && rootId.indexOf('*') >= 0) {
      rootId = dirname(rootId)
    }

    const root = join(cfg.root, rootId)
    if (rootId && fs.isDir(root)) {
      glob = glob.slice(rootId.length)
      const match = createMatcher([glob])!
      crawl(root, {
        filter: () => false,
        enter(dir) {
          if (!match(dir) || NODE_MODULES.test(dir)) {
            return false
          }
          const pkg = addPackage(join(rootId, dir))
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

  if (cfg.parent) {
    loadVendors(cfg.parent, packages)
    loadPackages(cfg.parent, packages)
  }

  return packages
}
