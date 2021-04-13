import { isTest } from '@alloc/is-dev'
import AsyncTaskGroup from 'async-task-group'
import { formatElapsed, success } from 'misty'
import { startTask } from 'misty/task'
import { join } from 'path'
import { fs } from './fs'
import { cwdRelative, log, time } from './helpers'
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
      const startTime = Date.now()

      const installer = new AsyncTaskGroup(3)
      await installer.map(packages, async pkg => {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        if (!Object.keys(deps).length) {
          return
        }
        const nodeModulesPath = join(pkg.root, 'node_modules')
        if (force || !fs.isDir(nodeModulesPath)) {
          const task = startTask(
            `Installing ${log.lcyan(cwdRelative(pkg.root))} node_modules…`
          )
          const npm = pkg.manager
          try {
            await npm.install()
            installed.push(pkg)
            task.finish()
          } catch (e) {
            task.finish()
            log(
              log.red('⨯'),
              'Installation failed:',
              log.lyellow(cwdRelative(pkg.path))
            )
            if (isTest) {
              throw e
            }
            log.error(e.message)
          }
        }
      })

      if (installed.length)
        success(
          `Installed node_modules of ${log.green(
            '' + installed.length
          )} packages ${log.gray(formatElapsed(startTime))}`
        )
    })

  return installed
}

export const buildPackages = (packages: Package[]) =>
  time('build packages', async () => {
    const startTime = Date.now()
    let buildCount = 0

    const builder = new AsyncTaskGroup(3)
    await builder.map(packages, async pkg => {
      const npm = pkg.manager
      if (packageBuildsOnInstall(pkg)) {
        return // Already built.
      }
      const promise = npm.run('build')
      if (promise) {
        const task = startTask(`Building ${log.lcyan(cwdRelative(pkg.root))}…`)
        buildCount++
        try {
          await promise
          task.finish()
        } catch (e) {
          task.finish()
          log(
            log.lred('⨯'),
            'Build script failed:',
            log.yellow(cwdRelative(pkg.root))
          )
          if (isTest) {
            throw e
          }
          log.error(e.message)
        }
      }
    })

    if (buildCount)
      success(
        `Built ${log.green('' + buildCount)} packages ${log.gray(
          formatElapsed(startTime)
        )}`
      )
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
