import { isTest } from '@alloc/is-dev'
import AsyncTaskGroup from 'async-task-group'
import { cpuCount, requestCPU } from './cpu'
import { cwdRelative, cyan, log, startTask, time, yellow } from './helpers'
import { Package } from './Package'

/**
 * For the given `packages` map, run the build script of every package used
 * as a key. The dependency array of each package is used to ensure dependencies
 * are built first.
 */
export const buildPackages = (packages: Package[]) =>
  time('build packages', async () => {
    const built = new Set<Package>()
    const builds = new AsyncTaskGroup(cpuCount, async (pkg: Package) => {
      let shouldBuild = true
      for (const dep of pkg.localDependencies) {
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
    log.debug(
      'build packages:',
      packages.map(pkg => cwdRelative(pkg.root))
    )
    await builds.concat(packages)
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
      log.debug('build start:', yellow(cwdRelative(pkg.root)))
      const task = startTask(`Building ${cyan(cwdRelative(pkg.root))}…`)
      try {
        await promise
        task.finish()
        log.debug('build completed:', yellow(cwdRelative(pkg.root)))
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
