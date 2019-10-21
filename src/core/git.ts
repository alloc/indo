import exec from '@cush/exec'
import { RepoConfig } from './config'

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
}
