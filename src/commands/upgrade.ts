import { prompt } from 'enquirer'
import { join } from 'path'
import semver from 'semver'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { fs } from '../core/fs'
import { getPublishedVersions } from '../core/getPublishedVersions'
import {
  choose,
  cwdRelative,
  fatal,
  log,
  spin,
  splitNameVersion,
} from '../core/helpers'
import { linkPackages } from '../core/linkPackages'
import { loadPackages } from '../core/loadPackages'
import { loadPackage, Package, resetPackageCache } from '../core/Package'

const NODE_MODULES = 'node_modules'
const PJ = 'package.json'

export default async (cfg: RootConfig) => {
  const args = slurm({
    dev: true,
    D: 'dev',
  })
  if (!args.length) {
    fatal('Must provide one or more dependency names')
  }

  const packages = loadPackages(cfg)

  const rootPkg = loadPackage(join(cfg.root, 'package.json'))
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

      const pkgPath = join(pkg.root, NODE_MODULES, alias, PJ)
      const { version } = fs.readJson(pkgPath)

      const versionIdx = knownVersions.indexOf(version)
      const greaterVersions = knownVersions.slice(versionIdx + 1)
      if (!greaterVersions.length) {
        return
      }
      log(
        '\nFound %s required by %s',
        log.lyellow(nameArg + '@' + version),
        log.lgreen(cwdRelative(pkg.root))
      )

      // These choices are never printed.
      const CHOOSE = { toString: () => '' }
      const SKIP = { toString: () => '' }

      type Choice = string | 1 | 0
      let { choice } = await prompt<{ choice: Choice }>({
        name: 'choice',
        type: 'autocomplete',
        message: 'What should we do?',
        choices: [
          { value: versionArg, message: 'Upgrade to ' + versionArg },
          { value: CHOOSE, message: 'Upgrade to...' },
          { value: SKIP, message: 'Skip' },
        ] as any,
      })
      if (choice == SKIP) {
        return
      }
      if (choice == CHOOSE) {
        prevChoice = choice = await choose(
          'Select a version',
          getVersionRanges(greaterVersions),
          prevChoice
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

    const spinner = spin('Upgrading dependencies [0/0]')
    const promise = Promise.all(
      Array.from(upgradesByPkg, ([pkg, upgrades]) => {
        spinner.start(
          `Upgrading dependencies [${done}/${(count += upgrades.length)}]`
        )
        return pkg.manager
          .add(upgrades, { dev: !!args.dev })
          .then(() =>
            spinner.start(
              `Upgrading dependencies [${(done += upgrades.length)}/${count}]`
            )
          )
      })
    )

    await promise
    spinner.stop()

    // Ensure the new dependencies are linked up.
    resetPackageCache()
    linkPackages(cfg)
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
