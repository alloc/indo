import AsyncTaskGroup from 'async-task-group'
import { join } from 'path'
import fs from 'saxon/sync'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { git } from '../core/git'
import { choose, log, spin } from '../core/helpers'
import { installAndBuild } from '../core/installAndBuild'
import { linkPackages } from '../core/linkPackages'
import { loadPackages } from '../core/loadPackages'
import { PackageMap } from '../core/Package'

export default async (cfg: RootConfig) => {
  const args = slurm({
    force: { type: 'boolean' },
    f: 'force',
  })
  await cloneMissingRepos(cfg)
  const packages = loadPackages(cfg.root, {
    skip: cfg.vendor,
  })
  await findUnknownRepos(cfg, packages)
  await installAndBuild(cfg, Object.values(packages))
  linkPackages(cfg, packages, {
    force: args.force,
  })
}

async function cloneMissingRepos(cfg: RootConfig) {
  const repos = Object.entries(cfg.repos)
  if (repos.length) {
    const spinner = spin('Cloning any missing repos...')

    const cloner = new AsyncTaskGroup(3)
    await cloner.map(repos, async ([path, repo]) => {
      if (!fs.exists(join(cfg.root, path))) {
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
  const gitRoots = git.findRoots(cfg, Object.values(packages))

  let changed = false
  for (let rootId of Array.from(gitRoots)) {
    if (cfg.repos[rootId]) {
      continue
    }
    const cwd = join(cfg.root, rootId)
    if (fs.isDir(join(cwd, '.git'))) {
      log.warn('Found an untracked repository:', log.lcyan(rootId))
      const answer = await choose('Pick an action:', [
        { message: 'Add to repos', value: 0 as const },
        { message: 'Add to vendor', value: 1 as const },
      ])

      changed = true
      if (answer == 0) {
        cfg.repos[rootId] = {
          url: git.getRemoteUrl(cwd, 'origin'),
          head: git.getTagForCommit(cwd) || git.getActiveBranch(cwd),
        }
      } else if (answer == 1) {
        cfg.vendor.push(rootId + '/**')
      }
    }
  }

  if (changed) {
    saveConfig(cfg)
  }
}
