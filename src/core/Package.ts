import exec from '@cush/exec'
import log from 'lodge'
import { dirname, join } from 'path'
import fs from 'saxon/sync'
import { fatal } from './helpers'
import { getPackageManager, PackageManager } from './npm'

export type PackageMap = { [path: string]: Package }
export type StringMap = { [name: string]: string }

const packageCache: PackageMap = {}

export class Package {
  path!: string
  name!: string
  version!: string
  dependencies?: StringMap
  devDependencies?: StringMap
  workspaces?: string[] | { packages: string[] }
  scripts?: StringMap

  constructor(path: string) {
    Object.defineProperty(this, 'path', {
      value: path,
      writable: true,
    })
    try {
      Object.assign(this, JSON.parse(fs.read(path)))
    } catch (err) {
      log.warn('Failed to read:', path)
      fatal(err)
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

  /** Move the entire package, updating its path */
  move(root: string) {
    fs.rename(this.root, root)
    this.path = join(root, 'package.json')
  }
}

export function loadPackage(pkgPath: string) {
  let pkg = packageCache[pkgPath]
  if (!pkg) {
    if (!fs.isFile(pkgPath)) return null
    packageCache[pkgPath] = pkg = new Package(pkgPath)
  }
  return pkg
}
