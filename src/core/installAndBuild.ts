import AsyncTaskGroup from 'async-task-group'
import { join } from 'path'
import { RootConfig } from './config'
import { fs } from './fs'
import { cwdRelative, log, spin, time } from './helpers'
import { Package } from './Package'

export async function installAndBuild(cfg: RootConfig, pkgs: Package[]) {
  const installed: Package[] = []

  await time('install dependencies', async () => {
    const spinner = spin('Installing dependencies...')

    const installer = new AsyncTaskGroup(3)
    await installer.map(pkgs, async pkg => {
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (!Object.keys(deps).length) {
        return
      }
      const nodeModulesPath = join(pkg.root, 'node_modules')
      if (!fs.isDir(nodeModulesPath)) {
        const npm = pkg.manager
        try {
          await npm.install(['--ignore-scripts'])
          installed.push(pkg)
          spinner.log(
            log.green('✓'),
            'Installed',
            log.green(cwdRelative(pkg.root)),
            'dependencies using',
            log.lcyan(pkg.manager.name)
          )
        } catch {
          spinner.log(
            log.red('⨯'),
            'Failed to install dependencies of',
            log.lyellow(cwdRelative(pkg.root))
          )
        }
      }
    })

    spinner.stop()
  })

  if (installed.length) {
    return buildPackages(cfg, installed)
  }
}

const buildPackages = (cfg: RootConfig, packages: Package[]) =>
  time('build packages', async () => {
    const spinner = spin('Building packages...')

    const builder = new AsyncTaskGroup(3)
    await builder.map(packages, async pkg => {
      const npm = pkg.manager
      const promise = npm.run('build')
      if (promise) {
        try {
          await promise
          spinner.log(
            log.green('✓'),
            'Built',
            log.green(cwdRelative(pkg.root)),
            'with',
            log.lcyan(npm.commands.run + ' build')
          )
        } catch (err) {
          spinner.log(
            log.lred('⨯'),
            'Build script failed:',
            log.yellow(cwdRelative(pkg.root))
          )
        }
      }
    })

    spinner.stop()
  })
