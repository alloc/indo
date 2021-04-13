import exec from '@cush/exec'
import { dirname, join, relative } from 'path'
import { fs } from './fs'
import { RepoConfig, RootConfig } from './config'
import { sparseClone } from './sparseClone'
import { isHomeDir } from './helpers'
import { Package } from './Package'

export const git = {
  clone(cwd: string, repo: RepoConfig, path: string) {
    if (repo.head?.includes(':')) {
      const [head, subpath] = repo.head!.split(':')
      return sparseClone(join(cwd, path), repo.url, head, subpath)
    }
    return exec(
      `git clone ${repo.url} ${path} --depth 1`,
      [repo.head ? ['-b', repo.head] : null],
      { cwd }
    )
  },
  getRemoteUrl(cwd: string, remote = 'origin') {
    return exec.sync(`git remote get-url ${remote}`, { cwd })
  },
  getTagForCommit(cwd: string, commit = 'HEAD') {
    return exec.sync(`git tag -l --points-at ${commit}`, { cwd })
  },
  getActiveBranch(cwd: string) {
    return exec.sync('git rev-parse --abbrev-ref HEAD', { cwd })
  },
  getRemotes(cwd: string) {
    const remotes: { [name: string]: { name: string; url: string } } = {}
    const lines = exec.sync('git remote -v', { cwd }).split('\n')
    lines.forEach(line => {
      const [, name, url] = /([^\s]+)\s([^\s]+)/.exec(line)!
      remotes[name] = { name, url }
    })
    return Object.values(remotes)
  },
  findRoot(cwd: string) {
    let root = cwd
    while (!isHomeDir(root)) {
      const gitDir = join(root, '.git')
      if (fs.isDir(gitDir)) {
        return root
      }
      root = dirname(root)
    }
  },
  findRoots(cfg: RootConfig, packages: Package[]) {
    const gitRoots = new Set<string>()
    for (const pkg of packages) {
      // Find the parent ".git" directory closest to "cfg.root"
      let root: string | undefined
      let dir = relative(cfg.root, pkg.root)
      while (dir !== '.') {
        // Stop early for tracked repos
        if (cfg.repos[dir]) {
          root = dir
          break
        }
        if (fs.isDir(join(dir, '.git'))) {
          root = dir
        }
        // Keep going until "cfg.root"
        dir = dirname(dir)
      }
      if (root) {
        gitRoots.add(root)
      }
    }
    return gitRoots
  },
}
