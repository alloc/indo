import AsyncTaskGroup from 'async-task-group'
import log from 'lodge'
import ora from 'ora'
import { join, relative } from 'path'
import fs from 'saxon/sync'
import { RootConfig } from './config'
import { spin } from './helpers'
import { Package } from './Package'

export async function installAndBuild(cfg: RootConfig, pkgs: Package[]) {
  const spinner = spin('Installing dependencies...')

  const installed: Package[] = []
  const installer = new AsyncTaskGroup(3)
  await installer.map(pkgs, async pkg => {
    if (!pkg.dependencies && !pkg.devDependencies) {
      return
    }
    const nodeModulesPath = join(pkg.root, 'node_modules')
    if (!fs.isDir(nodeModulesPath)) {
      const npm = pkg.manager
      await npm.install(['--ignore-scripts'])
      installed.push(pkg)
      spinner.log(
        log.green('✓'),
        'Installed',
        log.green('./' + relative(cfg.root, pkg.root)),
        'dependencies using',
        log.lcyan(pkg.manager.name)
      )
    }
  })

  spinner.stop()

  if (installed.length) {
    spinner.start('Building packages...')

    const builder = new AsyncTaskGroup(3)
    await builder.map(installed, async pkg => {
      const npm = pkg.manager
      const promise = npm.run('build')
      if (promise) {
        try {
          await promise
          spinner.log(
            log.green('✓'),
            'Built',
            log.green('./' + relative(cfg.root, pkg.root)),
            'with',
            log.lcyan(npm.commands.run + ' build')
          )
        } catch (err) {
          spinner.log(
            log.lred('⨯'),
            'Build script failed:',
            log.yellow('./' + relative(cfg.root, pkg.root))
          )
        }
      }
    })

    spinner.stop()
  }
}
