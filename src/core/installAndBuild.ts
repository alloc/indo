import { isTest } from '@alloc/is-dev'
import AsyncTaskGroup from 'async-task-group'
import { join } from 'path'
import { fs } from './fs'
import { cwdRelative, log, startTask, time, cyan, red, yellow } from './helpers'
import { Package } from './Package'

export async function installAndBuild(packages: Package[]) {
  const installed = await installPackages(packages)
  if (installed.length) {
    return buildPackages(installed)
  }
}

export async function installPackages(packages: Package[], force?: boolean) {
  const installed: Package[] = []

  if (packages.length)
    await time('install dependencies', async () => {
      const installer = new AsyncTaskGroup(3)
      await installer.map(packages, async pkg => {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        if (!Object.keys(deps).length) {
          return
        }
        const nodeModulesPath = join(pkg.root, 'node_modules')
        if (force || !fs.isDir(nodeModulesPath)) {
          const task = startTask(
            `Installing ${cyan(cwdRelative(pkg.root))} node_modules…`
          )
          const npm = pkg.manager
          try {
            await npm.install()
            installed.push(pkg)
            task.finish()
            log.events.emit('install', pkg)
          } catch (e) {
            task.finish()
            log(red('⨯'), 'Installation failed:', yellow(cwdRelative(pkg.path)))
            if (isTest) {
              throw e
            }
            log.error(e.message)
          }
        }
      })
    })

  return installed
}

export const buildPackages = (packages: Package[]) =>
  time('build packages', async () => {

    const builder = new AsyncTaskGroup(3)
    await builder.map(packages, async pkg => {
      const npm = pkg.manager
      if (packageBuildsOnInstall(pkg)) {
        return // Already built.
      }
      const promise = npm.run('build')
      if (promise) {
        const task = startTask(`Building ${cyan(cwdRelative(pkg.root))}…`)
        try {
          await promise
          task.finish()
          log.events.emit('build', pkg)
        } catch (e) {
          task.finish()
          log(red('⨯'), 'Build script failed:', yellow(cwdRelative(pkg.root)))
          if (isTest) {
            throw e
          }
          log.error(e.message)
        }
      }
    })

  })

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
