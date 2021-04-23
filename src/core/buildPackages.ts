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
export async function buildPackages(packages: Package[]) {
  if (!packages.length) return
  await time('build packages', async () => {
    const built = new Set<Package>()
    const failed = new Set<Package>()
    const builds = new AsyncTaskGroup(cpuCount, async (pkg: Package) => {
      let shouldBuild = true
      for (const dep of pkg.localDependencies) {
        if (built.has(dep) || !packages.includes(dep)) continue
        if (failed.has(dep)) return
        shouldBuild = false
      }

      if (shouldBuild) {
        if (await buildPackage(pkg)) {
          built.add(pkg)
        } else {
          failed.add(pkg)
        }
      } else {
        // Avoid infinite recursion.
        await new Promise(done => setTimeout(done, 10))
        builds.push(pkg)
      }
    })
    log.debug(
      'build packages:',
      packages.map(pkg => cwdRelative(pkg.root))
    )
    await builds.concat(packages)
  })
}

export async function buildPackage(pkg: Package) {
  if (packageBuildsOnInstall(pkg)) {
    return true // Already built.
  }
  const cpu = await requestCPU()
  try {
    const npm = pkg.manager
    const promise = npm.run('build')
    if (!promise) {
      return true // No build script.
    }
    log.debug('build start:', yellow(cwdRelative(pkg.root)))
    const task = startTask(`Building ${cyan(cwdRelative(pkg.root))}`)
    try {
      await promise
    } catch (e) {
      task.finish()
      log.error('Build script failed:', yellow(cwdRelative(pkg.root)))
      if (isTest) {
        throw e
      }
      log.error(e.message)
      return false
    }
    task.finish()
    log.debug('build completed:', yellow(cwdRelative(pkg.root)))
  } finally {
    cpu.release()
  }
  log.events.emit('build', pkg)
  return true
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
