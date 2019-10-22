import AsyncTaskGroup from 'async-task-group'
import log from 'lodge'
import ora from 'ora'
import { join, relative } from 'path'
import fs from 'saxon/sync'
import { RepoConfig, RootConfig, saveConfig } from '../core/config'
import { git } from '../core/git'
import { choose } from '../core/helpers'
import { installAndBuild } from '../core/installAndBuild'
import { linkPackages } from '../core/linkPackages'
import { loadPackages } from '../core/loadPackages'
import { PackageMap } from '../core/Package'

export default async (cfg: RootConfig) => {
  await cloneMissingRepos(cfg)
  const packages = loadPackages(cfg.root, {
    skip: cfg.vendor,
  })
  await findUnknownRepos(cfg, packages)
  await installAndBuild(cfg, Object.values(packages))
  linkPackages(cfg, packages)
}

async function cloneMissingRepos(cfg: RootConfig) {
  const repos = Object.entries(cfg.repos)
  if (repos.length) {
    const spinner = ora('Cloning any missing repos...').start()

    const cloned: Array<[string, RepoConfig]> = []
    const cloner = new AsyncTaskGroup(3)
    await cloner.map(repos, arg => {
      const [path, repo] = arg
      if (!fs.exists(path)) {
        cloned.push(arg)
        return git.clone(cfg.root, repo, path)
      }
    })

    spinner.stop()
    cloned.forEach(([path, repo]) => {
      let repoId = repo.url
      if (repo.head) {
        repoId += '#' + repo.head
      }
      log(
        log.green('+'),
        `Cloned ${log.green('./' + path)} from`,
        log.gray(repoId.replace(/^.+:\/\//, ''))
      )
    })
  }
}

async function findUnknownRepos(cfg: RootConfig, packages: PackageMap) {
  let changed = false
  for (const pkg of Object.values(packages)) {
    const root = relative(cfg.root, pkg.root)
    if (!root || cfg.repos[root]) {
      continue
    }
    if (fs.isDir(join(pkg.root, '.git'))) {
      changed = true
      log.warn('Package', log.lcyan(root), 'has an untracked repository.')
      const answer = await choose('Pick an action:', [
        { message: 'Add to repos', value: 0 as const },
        { message: 'Add to vendor', value: 1 as const },
      ])
      if (answer == 0) {
        cfg.repos[root] = {
          url: git.getRemoteUrl(pkg.root, 'origin'),
          head: git.getTagForCommit(pkg.root) || git.getActiveBranch(pkg.root),
        }
      } else if (answer == 1) {
        cfg.vendor.push(root)
      }
    }
  }
  if (changed) {
    saveConfig(cfg)
  }
}
