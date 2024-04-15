import exec from '@cush/exec'
import { dirname, join, relative } from 'path'
import { fs } from './fs'
import { RepoConfig, RootConfig } from './config'
import { sparseClone } from './sparseClone'
import { isHomeDir } from './helpers'
import { Package } from './Package'
import shell from '@cush/shell'

export const git = {
  clone(cwd: string, repo: RepoConfig, path: string) {
    const { branch, commit, subpath } = parseGitString(repo.head)

    if (subpath) {
      return sparseClone(join(cwd, path), repo.url, branch, commit, subpath)
    }

    let checkoutCommand = `git clone ${repo.url} ${path} --depth 1`
    if (branch) {
      checkoutCommand += ` -b ${branch}`
    }
    if (commit) {
      checkoutCommand += ` && git checkout ${commit}`
      return shell(checkoutCommand, { cwd })
    }
    return exec(checkoutCommand, { cwd })
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

function parseGitString(
  gitString: string | undefined
): {
  branch: string | undefined
  commit: string | undefined
  subpath: string | undefined
} {
  let branch: string | undefined
  let commit: string | undefined
  let subpath: string | undefined

  if (gitString?.length > 0) {
    if (gitString.includes(':')) {
      ;[gitString, subpath] = gitString.split(':')
    }

    if (gitString.includes('#')) {
      ;[branch, commit] = gitString.split('#')
    } else if (/^[0-9a-f]{40}$/.test(gitString)) {
      commit = gitString
    } else {
      branch = gitString
    }
  }

  return { branch, commit, subpath }
}
