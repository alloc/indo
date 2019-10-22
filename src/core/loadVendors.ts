import { dirname, join, relative } from 'path'
import { crawl, createMatcher } from 'recrawl-sync'
import fs from 'saxon/sync'
import { RootConfig } from './config'
import { loadPackage, PackageMap } from './Package'

export function loadVendors(cfg: RootConfig) {
  const packages: PackageMap = {}
  const addPackage = (dir: string) => {
    const pkgPath = join(cfg.root, dir, 'package.json')
    const pkg = loadPackage(pkgPath)
    if (pkg) packages[pkg.name] = pkg
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
          if (!match(dir)) {
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

  return packages
}
