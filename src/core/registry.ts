import * as os from 'os'
import { dirname, join } from 'path'
import fs from 'saxon/sync'

/** Local package registry */
export class Registry {
  packages!: { [name: string]: string }
  constructor(readonly root: string) {}

  get path() {
    return join(this.root, 'registry.json')
  }

  get packageDir() {
    return join(this.root, 'packages')
  }

  get(name: string) {
    this._load()
    return this.packages[name] || null
  }

  set(name: string, target: string) {
    this._load()

    const link = join(this.packageDir, name)
    fs.remove(link)
    fs.mkdir(dirname(link))
    fs.link(link, target)

    this.packages[name] = target
    this._save()
  }

  delete(name: string) {
    this._load()
    fs.remove(join(this.packageDir, name))
    delete this.packages[name]
    this._save()
  }

  protected _load() {
    if (!this.packages) {
      this.packages = fs.isFile(this.path) ? JSON.parse(fs.read(this.path)) : {}
    }
  }

  protected _save() {
    fs.write(this.path, JSON.stringify(this.packages, null, 2))
  }
}

export const registry = new Registry(join(os.homedir(), '.indo'))
