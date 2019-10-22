import AsyncTaskGroup from 'async-task-group'
import log from 'lodge'
import { dirname, join, relative } from 'path'
import fs from 'saxon/sync'
import { RootConfig, saveConfig } from '../core/config'
import { git } from '../core/git'
import { choose, spin } from '../core/helpers'
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
    const spinner = spin('Cloning any missing repos...')

    const cloner = new AsyncTaskGroup(3)
    await cloner.map(repos, async ([path, repo]) => {
      if (!fs.exists(path)) {
        const repoId = repo.url + (repo.head ? '#' + repo.head : '')
        try {
          await git.clone(cfg.root, repo, path)
          spinner.log(
            log.green('+'),
            `Cloned ${log.green('./' + path)} from`,
            log.gray(repoId.replace(/^.+:\/\//, ''))
          )
        } catch (err) {
          spinner.error(err)
        }
      }
    })

    spinner.stop()
  }
}

async function findUnknownRepos(cfg: RootConfig, packages: PackageMap) {
  const gitRoots = new Set<string>()
  for (const pkg of Object.values(packages)) {
    // Find the parent ".git" directory closest to "cfg.root"
    let root: string | undefined
    let dir = relative(cfg.root, pkg.root)
    while (dir !== '.') {
      if (cfg.repos[dir]) break
      if (fs.isDir(join(dir, '.git'))) {
        root = dir
      }
      dir = dirname(dir)
    }
    if (root) {
      gitRoots.add(root)
    }
  }

  let changed = false
  for (const root of Array.from(gitRoots)) {
    if (fs.isDir(join(root, '.git'))) {
      log.warn('Found an untracked repository:', log.lcyan(root))
      const answer = await choose('Pick an action:', [
        { message: 'Add to repos', value: 0 as const },
        { message: 'Add to vendor', value: 1 as const },
      ])

      changed = true
      if (answer == 0) {
        cfg.repos[root] = {
          url: git.getRemoteUrl(root, 'origin'),
          head: git.getTagForCommit(root) || git.getActiveBranch(root),
        }
      } else if (answer == 1) {
        cfg.vendor.push(root + '/**')
      }
    }
  }

  if (changed) {
    saveConfig(cfg)
  }
}
