import { basename, dirname, isAbsolute, join, relative } from 'path'
import { createMatcher, GlobMatcher } from 'recrawl-sync'
import { fs } from './fs'
import { isHomeDir } from './helpers'

const readLines = (path: string) => fs.read(path).split(/\r?\n/)

type GlobTree = { [pathId: string]: GlobMatcher | false | null }

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

  append(glob: string, rootDir = this.rootDir) {
    if (!this._check(rootDir, glob)) {
      const gitIgnorePath = join(rootDir, '.gitignore')
      if (fs.isFile(gitIgnorePath)) {
        const contents = fs.read(gitIgnorePath).trim() + '\n' + glob + '\n'
        fs.write(gitIgnorePath, contents)
      }
    }
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
      if (this._check(dir, file, name)) {
        return true
      }

      // Never use .gitignore outside the git repository.
      if (fs.isDir(join(dir, '.git'))) {
        break
      }
    }
    return false
  }

  _check(rootDir: string, file: string, name?: string) {
    const gitIgnorePath = join(rootDir, '.gitignore')
    const gitIgnoreId = relative(this.rootDir, gitIgnorePath)

    let match = this.globTree[gitIgnoreId]
    if (match !== false) {
      if (match) {
        if (match(file, name)) {
          return true
        }
      } else if (fs.isFile(gitIgnorePath)) {
        const lines = readLines(gitIgnorePath).filter(
          line => line && line[0] !== '#'
        )
        match = createMatcher(lines, glob => join(rootDir, glob))
        this.globTree[gitIgnoreId] = match || false
        if (match && match(file, name)) {
          return true
        }
      } else {
        this.globTree[gitIgnoreId] = false
      }
    }
    return false
  }
}
