import exec from '@cush/exec'
import { dirname, join, relative } from 'path'
import fs from 'saxon/sync'
import { RepoConfig, RootConfig } from './config'
import { Package } from './Package'

export const git = {
  clone(cwd: string, repo: RepoConfig, path: string) {
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
