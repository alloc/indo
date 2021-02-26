import AsyncTaskGroup from 'async-task-group'
import { join } from 'path'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { fs } from '../core/fs'
import { git } from '../core/git'
import { choose, cwdRelative, log, spin, time } from '../core/helpers'
import { installAndBuild } from '../core/installAndBuild'
import { linkPackages } from '../core/linkPackages'
import { loadPackages } from '../core/loadPackages'
import { loadPackage, PackageMap } from '../core/Package'

export default async (cfg: RootConfig) => {
  const args = slurm({
    force: { type: 'boolean' },
    f: 'force',
  })

  await time('clone missing repos', () => cloneMissingRepos(cfg))

  const packages = time('load non-vendor packages into memory', () =>
    loadPackages(cfg)
  )

  await time('find unknown repos', () => findUnknownRepos(cfg, packages))

  const rootPkg = time('load root package', () =>
    loadPackage(join(cfg.root, 'package.json'))
  )

  // Skip the install step if the root package uses Lerna or Yarn workspaces.
  if (!rootPkg || (!rootPkg.workspaces && !rootPkg.lerna)) {
    await installAndBuild(Object.values(packages))
  }

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
            `Cloned ${log.green(cwdRelative(path))} from`,
            log.gray(repoId.replace(/^.+:\/\//, ''))
          )
          const pkg = loadPackage(join(path, 'package.json'))
          if (pkg) {
            await installAndBuild([pkg])
          }
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
        { message: 'Add to repos', name: 'repos' },
        { message: 'Add to vendor', name: 'vendor' },
      ])

      changed = true
      if (answer == 'repos') {
        cfg.repos[rootId] = {
          url: git.getRemoteUrl(cwd, 'origin'),
          head: git.getTagForCommit(cwd) || git.getActiveBranch(cwd),
        }
      } else if (answer == 'vendor') {
        cfg.vendor.push(rootId + '/**')
      }
    }
  }

  if (changed) {
    saveConfig(cfg)
  }
}
