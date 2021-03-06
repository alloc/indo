import * as os from 'os'
import { dirname, join } from 'path'
import { fs } from './fs'

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
      this._packages = fs.isFile(this.path) ? fs.readJson(this.path) : {}
    }
  }

  protected _save() {
    fs.write(this.path, JSON.stringify(this._packages, null, 2))
  }
}

export const registry = new Registry(join(os.homedir(), '.indo'))
