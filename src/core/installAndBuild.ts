import { isTest } from '@alloc/is-dev'
import AsyncTaskGroup from 'async-task-group'
import { dirname, join, resolve } from 'path'
import { cpuCount, requestCPU } from './cpu'
import { fs } from './fs'
import { cwdRelative, log, startTask, time, cyan, yellow } from './helpers'
import { loadPackage, Package } from './Package'

export async function installAndBuild(packages: Package[]) {
  const installed = await installPackages(packages)
  if (installed.size) {
    return buildPackages(installed)
  }
}

export async function installPackages(packages: Package[], force?: boolean) {
  const installed = new Map<Package, Package[]>()

  if (packages.length)
    await time('install dependencies', async () => {
      const installer = new AsyncTaskGroup(cpuCount)
      await installer.map(packages, pkg => async () => {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        if (!Object.keys(deps).length) return

        // Find dependencies in the same repository.
        const localDeps: Package[] = []
        for (const [name, spec] of Object.entries(deps)) {
          if (!spec.startsWith('link:')) continue
          const depPath = resolve(pkg.root, spec.slice(5))
          if (depPath == pkg.root) continue
          if (!depPath.includes('node_modules')) {
            const dep = loadPackage(join(depPath, 'package.json'))
            dep && localDeps.push(dep)
          }
        }

        // Install their dependencies first.
        const installing = installPackages(localDeps)
        for (const [pkg, localDeps] of await installing) {
          installed.set(pkg, localDeps)
        }

        const nodeModulesPath = join(pkg.root, 'node_modules')
        if (force || !fs.isDir(nodeModulesPath)) {
          const cpu = await requestCPU()
          const task = startTask(
            `Installing ${cyan(cwdRelative(pkg.root))} node_modules…`
          )
          const npm = pkg.manager
          try {
            await npm.install()
            installed.set(pkg, localDeps)
            task.finish()
            log.debug('Install completed:', cwdRelative(pkg.root))
            log.events.emit('install', pkg)
          } catch (e) {
            task.finish()
            log.error('Installation failed:', yellow(cwdRelative(pkg.path)))
            if (isTest) {
              throw e
            }
            log.error(e.message)
          } finally {
            cpu.release()
          }
        }
      })
    })

  return installed
}

/**
 * For the given `packages` map, run the build script of every package used
 * as a key. The dependency array of each package is used to ensure dependencies
 * are built first.
 */
export const buildPackages = (packages: Map<Package, Package[]>) =>
  time('build packages', async () => {
    const built = new Set<Package>()
    const builds = new AsyncTaskGroup(cpuCount, async (pkg: Package) => {
      let shouldBuild = true
      for (const dep of packages.get(pkg) || []) {
        if (built.has(dep) || !builds.queue.includes(dep)) continue
        shouldBuild = false
      }

      if (shouldBuild) {
        await buildPackage(pkg)
        built.add(pkg)
      } else {
        builds.push(pkg)
      }
    })

    packages.forEach((_, pkg) => builds.push(pkg))
    await builds
  })

export async function buildPackage(pkg: Package) {
  if (packageBuildsOnInstall(pkg)) {
    return // Already built.
  }
  const cpu = await requestCPU()
  try {
    const npm = pkg.manager
    const promise = npm.run('build')
    if (promise) {
      const task = startTask(`Building ${cyan(cwdRelative(pkg.root))}…`)
      try {
        await promise
        task.finish()
        log.debug('Build completed:', cwdRelative(pkg.root))
        log.events.emit('build', pkg)
      } catch (e) {
        task.finish()
        log.error('Build script failed:', yellow(cwdRelative(pkg.root)))
        if (isTest) {
          throw e
        }
        log.error(e.message)
      }
    }
  } finally {
    cpu.release()
  }
}

/**
 * Look for a package script that runs on `npm install` and either
 * contains the word "build" or is identical to the build script.
 */
function packageBuildsOnInstall(pkg: Package) {
  const scripts = pkg.scripts || {}
  return [
    'preinstall',
    'install',
    'postinstall',
    'prepublish',
    'preprepare',
    'prepare',
    'postprepare',
  ].some(
    name =>
      name in scripts &&
      (/\b(build)\b/.test(scripts[name]) || scripts[name] == scripts.build)
  )
}
