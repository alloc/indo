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
            await npm.install(['--ignore-scripts'])
            installed.push(pkg)
            task.finish()
          } catch (e) {
            task.finish()
            log(
              log.red('⨯'),
              'Installation failed:',
              log.lyellow(cwdRelative(pkg.path))
            )
            log.error(e.message)
          }
        }
      })

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
          log.error(e.message)
        }
      }
    })

    success(
      `Built ${log.green('' + buildCount)} packages ${log.gray(
        formatElapsed(startTime)
      )}`
    )
  })
