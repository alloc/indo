import { isTest } from '@alloc/is-dev'
import AsyncTaskGroup from 'async-task-group'
import { join } from 'path'
import { cpuCount, requestCPU } from './cpu'
import { fs } from './fs'
import { cwdRelative, cyan, log, startTask, time, yellow } from './helpers'
import { Package } from './Package'

export async function installPackages(packages: Package[], force?: boolean) {
  const installed: Package[] = []

  if (packages.length)
    await time('install dependencies', async () => {
      const installer = new AsyncTaskGroup(cpuCount)
      await installer.map(packages, pkg => async () => {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        if (!Object.keys(deps).length) return

        const nodeModulesPath = join(pkg.root, 'node_modules')
        if (force || !fs.isDir(nodeModulesPath)) {
          const cpu = await requestCPU()
          const task = startTask(
            `Installing ${cyan(cwdRelative(pkg.root))} node_modules`
          )
          const logs: string[] = []
          const npm = pkg.manager
          try {
            await npm.install((err, log) => {
              logs.push(err || log)
            })

            installed.push(pkg)
            task.finish()
            log.debug('install completed:', yellow(cwdRelative(pkg.root)))
            log.events.emit('install', pkg)
          } catch (e) {
            task.finish()
            log.error('Installation failed:', yellow(cwdRelative(pkg.root)))
            if (isTest) {
              throw e
            }
            if (logs.length) log.error(logs.join('\n').trim())
            else log.error(e.message)
          } finally {
            cpu.release()
          }
        }
      })
    })

  return installed
}
