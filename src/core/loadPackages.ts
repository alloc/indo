import { join } from 'path'
import { crawl } from 'recrawl-sync'
import { GitIgnore } from './gitignore'
import { loadPackage, PackageMap } from './Package'

type CrawlOptions = Parameters<typeof crawl>[1]

export function loadPackages(root: string, opts: CrawlOptions = {}) {
  const gitignore = new GitIgnore(root)
  const notIgnored = (path: string) => {
    return !gitignore.test(join(root, path))
  }

  const paths = crawl(root, {
    ...opts,
    only: opts.only || ['**/package.json'],
    skip: ['.git', 'node_modules', ...(opts.skip || [])],
    enter: notIgnored,
    filter: notIgnored,
  })

  const packages: PackageMap = {}
  paths.forEach(pkgPath => {
    const pkg = loadPackage(join(root, pkgPath))!
    if (pkg.name && pkg.version) {
      packages[pkg.name] = pkg
    }
  })
  return packages
}
