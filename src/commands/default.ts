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
  warn,
  yellow,
} from '../core/helpers'

import {
  saveConfig,
  RootConfig,
  loadConfig,
  dotIndoId,
  loadTopConfig,
} from '../core/config'
import { collectVersionErrors, linkPackages } from '../core/linkPackages'
import { loadPackages } from '../core/loadPackages'
import { loadPackage, Package, PackageMap } from '../core/Package'
import { cpuCount, requestCPU } from '../core/cpu'
import { installPackages } from '../core/installPackages'
import { buildPackages } from '../core/buildPackages'

export default async (cfg: RootConfig) => {
  const args = slurm({
    force: { type: 'boolean' },
    f: 'force',
  })

  return indo(cfg.root, args.force)
}

export async function indo(cwd: string, force?: boolean) {
  const cfg = loadTopConfig(cwd)
  if (!cfg) return

  let buildCount = 0
  let installCount = 0
  log.events.on('build', () => buildCount++)
  log.events.on('install', () => installCount++)

  const configs: RootConfig[] = [cfg]
  log.events.on('config', (cfg: RootConfig) => configs.push(cfg))

  // Clone repos and find nested indo configs.
  await time('clone missing repos', () => cloneMissingRepos(cfg))

  const versionErrors = collectVersionErrors()

  const installed = new Set<Package>()
  const installer = new AsyncTaskGroup()

  // If all packages have their node_modules, this promise will
  // ensure the installer does not stall the process.
  installer.push(new Promise(done => setImmediate(done)))

  const linking = configs.reverse().map(async cfg => {
    const rootPkg = loadPackage(join(cfg.root, 'package.json'))
    const packages = time('find packages', () => loadPackages(cfg))

    log.debug('config found:', yellow(cwdRelative(cfg.path)))
    log.debug(
      'packages found:',
      Object.values(packages).map(pkg => cwdRelative(pkg.root))
    )

    // Skip the install step if the root package uses Lerna or Yarn workspaces.
    if (!rootPkg || (!rootPkg.workspaces && !rootPkg.lerna))
      installer.push(async () => {
        for (const pkg of await installPackages(Object.values(packages)))
          installed.add(pkg)
      })

    // Wait for dependencies before linking.
    await installer

    log.debug('link packages:', yellow(cwdRelative(cfg.root)))

    // Link packages before the build step.
    linkPackages(cfg, packages, { force })

    await findUnknownRepos(cfg, packages)
  })

  await Promise.all(linking)
  if (installed.size) {
    // Build packages needed by other local packages.
    const packages = Array.from(installed).filter(
      pkg => pkg.localDependents.size > 0
    )
    await buildPackages(packages)
  }

  versionErrors.forEach(err => {
    log.error(err.toString())
  })

  log('')
  success('Local packages are linked!')

  if (installCount)
    success(
      yellow(installCount),
      `package${installCount == 1 ? '' : 's'} had node_modules installed`
    )

  if (buildCount)
    success(
      yellow(buildCount),
      `package${buildCount == 1 ? ' was' : 's were'} built`
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
          if (/ not found/.test(err.message)) {
            return warn(
              `Repository not found or access denied:\n    ${repo.url}`
            )
          }
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
      warn(`Found an untracked repository: ${rootId}`)
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
