import { isTest } from '@alloc/is-dev'
import AsyncTaskGroup from 'async-task-group'
import { dirname, join, relative, resolve } from 'path'
import slurm from 'slurm'
import { fs } from '../core/fs'
import { git } from '../core/git'
import {
  choose,
  confirm,
  cwdRelative,
  cyan,
  green,
  isDescendant,
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
  RepoConfig,
} from '../core/config'
import { collectVersionErrors, linkPackages } from '../core/linkPackages'
import {
  loadPackage,
  Package,
  PackageMap,
  toPackagePath,
} from '../core/Package'
import { cpuCount, requestCPU } from '../core/cpu'
import { installPackages } from '../core/installPackages'
import { buildPackages } from '../core/buildPackages'
import { loadLinkManifest } from '../core/loadLinkManifest'
import { loadLocalPackages } from '../core/loadLocalPackages'
import { getPromptMemory } from '../core/promptMemory'

export default async (cfg: RootConfig) => {
  const args = slurm({
    config: { type: 'string' },
    force: { type: 'boolean' },
    skipOptional: { type: 'boolean' },
    skipInstall: { type: 'boolean' },
    c: 'config',
    f: 'force',
  })

  // The --config argument lets you override the `loadTopConfig` call.
  const configPath = args.config != null && resolve(args.config)
  const config =
    !!configPath &&
    loadConfig(
      configPath.endsWith(dotIndoId) ? configPath : join(configPath, dotIndoId)
    )

  return indo(cfg.root, {
    force: args.force,
    skipOptional: args.skipOptional,
    skipInstall: args.skipInstall,
    config,
  })
}

export async function indo(
  cwd: string,
  opts: {
    force?: boolean
    config?: RootConfig | false | null
    skipInstall?: boolean
    skipOptional?: boolean
  } = {}
) {
  const topConfig = opts.config || loadTopConfig(cwd)
  if (!topConfig) return

  let buildCount = 0
  let installCount = 0
  log.events.on('build', () => buildCount++)
  log.events.on('install', () => installCount++)

  let configs = [topConfig]
  log.events.on('config', (cfg: RootConfig) => configs.push(cfg))

  // If the working directory has an indo config, this variable
  // will use it (unless an explicit config is passed).
  // Otherwise, the top-most config is used.
  let mainConfig = topConfig

  // Ensure the $PWD/.indo.json config is used.
  if (!opts.config && topConfig.root !== cwd) {
    const cwdConfig = loadConfig(join(cwd, dotIndoId))
    if (cwdConfig) {
      mainConfig = cwdConfig
      configs.push(cwdConfig)
    }
  }

  // Clone repos and find nested indo configs.
  await time('clone missing repos', () =>
    cloneMissingRepos(mainConfig, opts.skipOptional)
  )

  // Skip setup for higher roots.
  configs = configs.filter(cfg => isDescendant(cfg.root, cwd))
  if (!configs.length) {
    return warn(
      'No ".indo.json" file was found in the current directory.\n    ' +
        'Try using the -c flag if you know where the ".indo.json" file is.'
    )
  }

  const versionErrors = collectVersionErrors()

  const installed = new Set<Package>()
  const installer = new AsyncTaskGroup()

  // If all packages have their node_modules, this promise will
  // ensure the installer does not stall the process.
  installer.push(new Promise(done => setImmediate(done)))

  const linking = configs.reverse().map(async cfg => {
    const rootPkg = loadPackage(toPackagePath(cfg.root))
    const packages = time('find packages', () => loadLocalPackages(cfg))

    log.debug('config found:', yellow(cwdRelative(cfg.path)))
    log.debug(
      'packages found:',
      Object.values(packages).map(pkg => cwdRelative(pkg.root))
    )

    const skipInstall =
      opts.skipInstall ||
      // Skip the install step if the root package uses Lerna or Yarn workspaces.
      (rootPkg && (rootPkg.workspaces || rootPkg.lerna))

    if (!skipInstall)
      installer.push(async () => {
        for (const pkg of await installPackages(Object.values(packages)))
          installed.add(pkg)
      })

    // Wait for dependencies before linking.
    await installer

    log.debug('link packages:', yellow(cwdRelative(cfg.root)))

    // Link packages before the build step.
    linkPackages(cfg, packages, {
      force: opts.force,
    })

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

function getRepoHash(repo: RepoConfig) {
  return repo.url
    ? repo.url.replace(/\.git$/, '') + '#' + (repo.head || 'master')
    : ''
}

async function cloneMissingRepos(cfg: RootConfig, skipOptional?: boolean) {
  const repos = Object.entries(cfg.repos)
  if (repos.length) {
    const repoPaths: { [hash: string]: string } = {}

    // Linked repos will be reused.
    const linkManifest = loadLinkManifest(cfg.root)
    linkManifest.find((link, linkPath) => {
      const hash = getRepoHash(link.repo)
      repoPaths[hash] = join(cfg.root, linkPath)
      return false
    })

    let promptQueue = Promise.resolve()

    const cloner = new AsyncTaskGroup(cpuCount, clone)
    await cloner.map(repos, entry => [...entry, cfg] as const)

    async function clone([path, repo, cfg]: [string, RepoConfig, RootConfig]) {
      const dest = join(cfg.root, path)
      const exists = fs.exists(dest)

      // Reuse identical clones from other indo roots.
      const repoHash = getRepoHash(repo)
      if (repoPaths[repoHash]) {
        if (exists) return
        fs.mkdir(dirname(dest))
        fs.link(dest, relative(dirname(dest), repoPaths[repoHash]))
        return log(
          green('+'),
          'Linked',
          green(cwdRelative(dest)),
          'to',
          yellow(cwdRelative(repoPaths[repoHash]))
        )
      }

      if (!exists && repo.optional) {
        if (skipOptional) return

        const promptMemory = getPromptMemory(cfg)
        const cacheKey = 'no-clone:' + path
        if (repoHash == promptMemory.get(cacheKey)) {
          return // Already prompted before.
        }

        let allow = false
        await (promptQueue = promptQueue.then(async () => {
          log.warn(`Found an optional repo:\n  ${yellow(repoHash)}`)
          log('')
          allow = await confirm(`Clone it into ${green(cwdRelative(dest))}`)
          log('')
        }))

        // Avoid prompting again if clone is unwanted.
        promptMemory.set(cacheKey, allow ? null : repoHash)
        if (!allow) return
      }

      // Currently, indo does not support nested .indo.json files that don't
      // have their own repository. As a workaround for testing purposes,
      // you can use an empty `repo` object to tell Indo to process the
      // nested .indo.json file anyway. In that case, the `repoHash` will
      // be an empty string, which should not be cached in `repoPaths`.
      if (repoHash) {
        repoPaths[repoHash] = dest
      }

      if (!exists) {
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
        } catch (err: any) {
          task.finish()
          if (/\bnot (read|found)\b/.test(err.message)) {
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
      // Linked repos are managed manually.
      else if (fs.isLink(dest)) return

      // Ensure breadth-first processing is done.
      await 0

      const destCfg = loadConfig(join(dest, dotIndoId))
      if (destCfg) {
        log.events.emit('config', destCfg)

        // Add nested repos to the clone queue.
        cloner.map(
          Object.entries(destCfg.repos),
          entry => [...entry, destCfg] as const
        )
      }
    }
  }
}

async function findUnknownRepos(cfg: RootConfig, packages: PackageMap) {
  const gitRoots = git.findRoots(cfg, Object.values(packages))
  const gitSubmodules = git.loadSubmodules(cfg.root)

  let changed = false
  for (let rootId of Array.from(gitRoots)) {
    if (cfg.repos[rootId] || rootId.startsWith('..')) {
      continue
    }
    if (gitSubmodules.includes(rootId)) {
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
