import { isTest } from '@alloc/is-dev'
import AsyncTaskGroup from 'async-task-group'
import { join } from 'path'
import slurm from 'slurm'
import { fs } from '../core/fs'
import { git } from '../core/git'
import {
  choose,
  cwdRelative,
  cyan,
  green,
  log,
  red,
  startTask,
  success,
  time,
} from '../core/helpers'

import { saveConfig, RootConfig, loadConfig, dotIndoId } from '../core/config'
import { installAndBuild } from '../core/installAndBuild'
import { linkPackages } from '../core/linkPackages'
import { loadPackages } from '../core/loadPackages'
import { loadPackage, Package, PackageMap } from '../core/Package'

export default async (cfg: RootConfig) => {
  const args = slurm({
    force: { type: 'boolean' },
    f: 'force',
  })

  const builds = new Set<Package>()
  const installed = new Set<Package>()
  log.events.on('build', (pkg: Package) => builds.add(pkg))
  log.events.on('install', (pkg: Package) => installed.add(pkg))

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

  if (installed.size)
    success(
      'Installed node_modules of',
      green(installed.size),
      'package' + (installed.size == 1 ? '' : 's')
    )

  if (builds.size)
    success(
      'Built',
      green(builds.size),
      'package' + (builds.size == 1 ? '' : 's')
    )

  linkPackages(cfg, packages, {
    force: args.force,
  })
}

async function cloneMissingRepos(cfg: RootConfig) {
  const repos = Object.entries(cfg.repos)
  if (repos.length) {
    const cloner = new AsyncTaskGroup(3)
    await cloner.map(repos, ([path, repo]) => async () => {
      const dest = join(cfg.root, path)
      if (!fs.exists(dest)) {
        const task = startTask('Cloning into ' + cyan(cwdRelative(dest)))
        try {
          await git.clone(cfg.root, repo, path)
          task.finish()
          log(
            green('+'),
            `Cloned ${green(cwdRelative(dest))} from`,
            repo.url.replace(/^.+:\/\//, '')
          )
        } catch (err) {
          task.finish()
          log.error('Failed to clone %s into %s', red(repo.url), cyan(path))
          if (isTest) throw err
          return log.error(err)
        }
      }
      await recursiveClone(dest)
    })
  }
}

/**
 * Clone any repos that cloned repos depend on.
 */
async function recursiveClone(root: string) {
  const cfg = loadConfig(join(root, dotIndoId))
  if (cfg) {
    await cloneMissingRepos(cfg)
  }
  const pkg = loadPackage(join(root, 'package.json'))
  if (pkg) {
    await installAndBuild([pkg])
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
      log.warn('Found an untracked repository:', cyan(rootId))
      const answer = await choose('Pick an action:', [
        { title: 'Add to repos', value: 'repos' },
        { title: 'Add to vendor', value: 'vendor' },
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
