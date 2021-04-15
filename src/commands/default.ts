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
  yellow,
} from '../core/helpers'

import { saveConfig, RootConfig, loadConfig, dotIndoId } from '../core/config'
import { buildPackages, installPackages } from '../core/installAndBuild'
import { linkPackages } from '../core/linkPackages'
import { loadPackages } from '../core/loadPackages'
import { loadPackage, Package, PackageMap } from '../core/Package'
import { cpuCount, requestCPU } from '../core/cpu'

export default async (cfg: RootConfig) => {
  const args = slurm({
    force: { type: 'boolean' },
    f: 'force',
  })

  let buildCount = 0
  let installCount = 0
  log.events.on('build', () => buildCount++)
  log.events.on('install', () => installCount++)

  const configs: RootConfig[] = [cfg]
  log.events.on('config', (cfg: RootConfig) => configs.push(cfg))

  // Clone repos and find nested indo configs.
  await time('clone missing repos', () => cloneMissingRepos(cfg))

  for (const cfg of configs.reverse()) {
    const rootPkg = loadPackage(join(cfg.root, 'package.json'))
    const packages = time('load non-vendor packages into memory', () =>
      loadPackages(cfg)
    )

    // Skip the install step if the root package uses Lerna or Yarn workspaces.
    let installed: Map<Package, Package[]> | undefined
    if (!rootPkg || (!rootPkg.workspaces && !rootPkg.lerna)) {
      installed = await installPackages(Object.values(packages))
    }

    // Link packages before the build step.
    linkPackages(cfg, packages, {
      force: args.force,
    })

    if (installed?.size) {
      await buildPackages(installed)
    }

    await findUnknownRepos(cfg, packages)
  }

  success('Local packages are linked!')

  if (installCount)
    success(
      yellow(installCount),
      `package${installCount == 1 ? '' : 's'} had node_modules installed`
    )

  if (buildCount)
    success(
      yellow(buildCount),
      `package${buildCount == 1 ? '' : 's'} were built`
    )
}

async function cloneMissingRepos(cfg: RootConfig) {
  const repos = Object.entries(cfg.repos)
  if (repos.length) {
    const cloner = new AsyncTaskGroup(cpuCount)
    await cloner.map(repos, ([path, repo]) => async () => {
      const dest = join(cfg.root, path)
      if (!fs.exists(dest)) {
        const cpu = await requestCPU()
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
        } finally {
          cpu.release()
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
    log.events.emit('config', cfg)
    await cloneMissingRepos(cfg)
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
