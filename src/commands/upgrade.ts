import prompt from 'prompts'
import semver from 'semver'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { fs } from '../core/fs'
import {
  choose,
  cwdRelative,
  fatal,
  green,
  log,
  splitNameVersion,
  startTask,
  yellow,
} from '../core/helpers'
import { getPublishedVersions } from '../core/getPublishedVersions'
import { loadLocalPackages } from '../core/loadLocalPackages'
import {
  loadPackage,
  Package,
  resetPackageCache,
  toPackagePath,
} from '../core/Package'
import { indo } from './default'

const NODE_MODULES = 'node_modules'

export default async (cfg: RootConfig) => {
  const args = slurm({
    dev: true,
    D: 'dev',
  })
  if (!args.length) {
    fatal('Must provide one or more dependency names')
  }

  const packages = loadLocalPackages(cfg)

  const rootPkg = loadPackage(toPackagePath(cfg.root))
  if (rootPkg) {
    packages[rootPkg.name] = rootPkg
  }

  type UpgradeMap = Map<Package, string[]>
  const upgradesByPkg: UpgradeMap = new Map()

  const type = args.dev
    ? ('devDependencies' as const)
    : ('dependencies' as const)

  for (const arg of args) {
    let { name: nameArg, version: versionArg } = splitNameVersion(arg)

    if (nameArg in cfg.alias) {
      nameArg = cfg.alias[nameArg]
    }

    if (!versionArg) {
      versionArg = 'latest'
    }

    const knownVersions = await getPublishedVersions(nameArg)

    let prevChoice: string | undefined
    const matchDependency = async (
      pkg: Package,
      alias: string,
      ref: string
    ) => {
      if (ref.startsWith('npm:')) {
        const { name } = splitNameVersion(ref.slice(4))
        if (name !== nameArg) {
          return
        }
      }

      const pkgPath = toPackagePath(pkg.root, NODE_MODULES, alias)
      const { version } = fs.readJson(pkgPath)

      const versionIdx = knownVersions.indexOf(version)
      const greaterVersions = knownVersions.slice(versionIdx + 1)
      if (!greaterVersions.length) {
        return
      }
      log(
        '\nFound %s required by %s',
        yellow(nameArg + '@' + version),
        green(cwdRelative(pkg.root))
      )

      // These choices are never printed.
      const CHOOSE = { toString: () => '' }
      const SKIP = { toString: () => '' }

      let { choice } = await prompt({
        name: 'choice',
        type: 'autocomplete',
        message: 'What should we do?',
        choices: [
          { value: versionArg, title: 'Upgrade to ' + versionArg },
          { value: CHOOSE, title: 'Upgrade to...' },
          { value: SKIP, title: 'Skip' },
        ],
      })
      if (choice == SKIP) {
        return
      }
      if (choice == CHOOSE) {
        const choices = getVersionRanges(greaterVersions)
        prevChoice = choice = await choose(
          'Select a version',
          choices.map(value => ({ title: value, value })),
          prevChoice ? choices.indexOf(prevChoice) : undefined
        )
      }
      let upgrades = upgradesByPkg.get(pkg)
      if (!upgrades) {
        upgradesByPkg.set(pkg, (upgrades = []))
      }
      if (choice == 'latest') {
        choice = '^' + knownVersions.slice(-1)[0]
      }
      if (alias !== nameArg) {
        choice = `npm:${nameArg}@${choice}`
      }
      upgrades.push(alias + '@' + choice)
    }

    for (const pkg of Object.values(packages)) {
      const deps = pkg[type]
      if (!deps) continue

      if (nameArg in deps) {
        await matchDependency(pkg, nameArg, deps[nameArg])
      }

      for (const [alias, ref] of Object.entries(deps)) {
        if (ref.startsWith('npm:')) {
          await matchDependency(pkg, alias, ref)
        }
      }
    }

    if (!upgradesByPkg.size) {
      log('\n✨  Everything is up-to-date.')
      return
    }

    log('')
    let done = 0
    let count = 0

    const task = startTask('Upgrading dependencies [0/0]')
    const promise = Promise.all(
      Array.from(upgradesByPkg, ([pkg, upgrades]) => {
        task.update(
          `Upgrading dependencies [${done}/${(count += upgrades.length)}]`
        )
        return pkg.manager
          .add(upgrades, { dev: !!args.dev })
          .then(() =>
            task.update(
              `Upgrading dependencies [${(done += upgrades.length)}/${count}]`
            )
          )
      })
    )

    await promise
    task.finish()

    resetPackageCache()
    await indo(cfg.root)
  }
}

function getVersionRanges(versions: string[]) {
  const rangesByMajor = new Map<number, Map<string, string>>()
  for (const version of versions) {
    const parsed = semver.parse(version)
    if (parsed) {
      let ranges = rangesByMajor.get(parsed.major)
      if (!ranges) {
        rangesByMajor.set(parsed.major, (ranges = new Map()))
      }
      ranges.set(parsed.major + '.' + parsed.minor, version)
    }
  }
  const ranges: string[] = []
  rangesByMajor.forEach(minors => {
    let major!: string
    minors.forEach(version => {
      ranges.push('~' + (major = version))
    })
    ranges.push('^' + major)
  })
  return ranges.reverse()
}
