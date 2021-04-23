import exec from '@cush/exec'
import { dirname, join } from 'path'
import { fs } from './fs'
import { cwdRelative, fatal, warn } from './helpers'
import { hasLernaConfig, LernaConfig, loadLernaConfig } from './lerna'
import { getPackageManager, PackageManager } from './npm'

export type PackageMap = { [path: string]: Package }
export type StringMap = { [name: string]: string }

let packageCache: PackageMap = {}

export const resetPackageCache = () => void (packageCache = {})

export class Package {
  path!: string
  name!: string
  version!: string
  dependencies?: StringMap
  devDependencies?: StringMap
  peerDependencies?: StringMap

  /** Local packages used by this one */
  localDependencies = new Set<Package>()

  /** Local packages using this one */
  localDependents = new Set<Package>()

  /** The scripts available to `npm run` */
  scripts?: StringMap

  /** The modules linked to `node_modules/.bin` */
  bin?: string | { [name: string]: string }

  /** Yarn workspaces config */
  workspaces?: string[] | { packages: string[] }

  /** Lerna config */
  lerna?: LernaConfig

  constructor(path: string) {
    Object.defineProperty(this, 'path', {
      value: path,
      writable: true,
    })
    try {
      Object.assign(this, fs.readJson(path))
    } catch (err) {
      warn(`Failed to read: ${cwdRelative(path)}`)
      fatal(err)
    }
    if (hasLernaConfig(this)) {
      Object.defineProperty(this, 'lerna', {
        configurable: true,
        get: () =>
          Object.defineProperty(this, 'lerna', {
            value: loadLernaConfig(this),
          }).lerna,
      })
    }
  }

  /** The root directory where "package.json" lives */
  get root() {
    return dirname(this.path)
  }

  get manager() {
    return Object.defineProperty(this, 'manager', {
      value: getPackageManager(this),
    }).manager as PackageManager
  }

  clone() {
    return Object.create(
      Package.prototype,
      Object.getOwnPropertyDescriptors(this)
    ) as this
  }

  /** Run a script */
  run(name: string, ...args: exec.Args) {
    if (this.scripts) {
      const script = this.scripts[name]
      if (script) {
        return this.manager.run(script, ...args)
      }
    }
    return null
  }

  /** Execute a command in the package root */
  exec(cmd: string, ...args: exec.Args) {
    return exec(cmd, ...args, { cwd: this.root })
  }

  /** Execute a command in the package root */
  execSync(cmd: string, ...args: exec.SyncArgs) {
    return exec.sync(cmd, ...args, { cwd: this.root })
  }

  /** Move the entire package, updating its path */
  move(root: string) {
    fs.rename(this.root, root)
    this.path = join(root, 'package.json')
  }
}

/** Get a cached package by its `package.json` path */
export function getPackage(pkgPath: string) {
  return packageCache[pkgPath]
}

/** Always pass an absolute path to `package.json` */
export function loadPackage(pkgPath: string) {
  let pkg = packageCache[pkgPath]
  if (!pkg) {
    if (!fs.isFile(pkgPath)) return null
    packageCache[pkgPath] = pkg = new Package(pkgPath)
  }
  return pkg
}
