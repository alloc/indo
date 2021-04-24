import { join } from 'path'
import { crawl } from 'recrawl-sync'
import { fs } from './fs'
import { GitIgnore } from './gitignore'

export function findPackages(root: string, skip: string[]) {
  if (!fs.isDir(root)) {
    return []
  }
  const gitignore = new GitIgnore(root)
  const notIgnored = (path: string) => {
    return !gitignore.test(join(root, path))
  }
  return crawl(root, {
    only: ['package.json'],
    skip: ['.git', 'node_modules', ...skip],
    enter: notIgnored,
    filter: notIgnored,
    absolute: true,
  })
}
