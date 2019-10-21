import { basename, dirname, isAbsolute, join, relative } from 'path'
import { createMatcher, GlobMatcher } from 'recrawl-sync'
import fs from 'saxon/sync'
import { isHomeDir } from './helpers'

const readLines = (path: string) => fs.read(path).split(/\r?\n/)

type GlobTree = { [pathId: string]: GlobMatcher | false }

export class GitIgnore {
  readonly matchRootGlobs: GlobMatcher | null
  constructor(
    /** Tree paths are relative to this */
    readonly rootDir: string,
    /** This maps tree paths to their own glob registry */
    readonly globTree: GlobTree = {},
    /** These globs are always used */
    readonly rootGlobs = ['.*', 'node_modules']
  ) {
    this.matchRootGlobs = createMatcher(rootGlobs)
  }

  test(file: string, name?: string) {
    if (!isAbsolute(file)) {
      throw Error('Expected an absolute path')
    }
    if (!name) {
      name = basename(file)
    }
    let match: GlobMatcher | false | null
    if ((match = this.matchRootGlobs)) {
      if (match(file, name)) return true
    }
    for (let dir = dirname(file); !isHomeDir(dir); dir = dirname(dir)) {
      const path = join(dir, '.gitignore')
      const pathId = relative(this.rootDir, path)

      match = this.globTree[pathId]
      if (match !== false) {
        if (match) {
          if (match(file, name)) {
            return true
          }
        } else if (fs.isFile(path)) {
          const lines = readLines(path).filter(line => line && line[0] !== '#')
          match = createMatcher(lines, glob => join(dir, glob))
          this.globTree[pathId] = match || false
          if (match && match(file, name)) {
            return true
          }
        } else {
          this.globTree[pathId] = false
        }
      }

      // Never use .gitignore outside the git repository.
      if (fs.isDir(join(dir, '.git'))) {
        break
      }
    }
    return false
  }
}
