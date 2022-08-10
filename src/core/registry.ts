import * as os from 'os'
import { dirname, join } from 'path'
import { writeFileSync, readFileSync } from 'atomically'
import { fs } from './fs'
import isDeepEqual from 'dequals'

/** Local package registry */
export class Registry {
  _packages!: { [name: string]: string }
  constructor(readonly root: string) {}

  get path() {
    return join(this.root, 'registry.json')
  }

  get packageDir() {
    return join(this.root, 'packages')
  }

  get packages() {
    this._load()
    return this._packages
  }

  get(name: string) {
    this._load()
    return this._packages[name] || null
  }

  set(name: string, target: string) {
    this._load()

    const link = join(this.packageDir, name)
    fs.remove(link)
    fs.mkdir(dirname(link))
    fs.link(link, target)

    this._packages[name] = target
    this._save()
  }

  delete(name: string) {
    this._load()
    fs.remove(join(this.packageDir, name))
    delete this._packages[name]
    this._save()
  }

  protected _load() {
    if (!this._packages) {
      try {
        this._packages = this._read()
      } catch (e: any) {
        if (e.code !== 'ENOENT') {
          console.error('Global registry is corrupted: ' + this.path)
          throw e
        }
        this._packages = {}
      }
    }
  }

  protected _read() {
    return JSON.parse(readFileSync(this.path, 'utf8'))
  }

  protected _save() {
    const content = JSON.stringify(this._packages, null, 2)
    writeFileSync(this.path, content)

    // Double check if we weren't overwritten by a parallel process.
    const current = this._read()
    if (!isDeepEqual(current, this._packages)) {
      this._packages = { ...current, ...this._packages }
      this._save()
    }
  }
}

export const registry = new Registry(join(os.homedir(), '.indo'))
