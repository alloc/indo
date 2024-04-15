import exitHook from 'exit-hook'
import { dirname } from 'path'
import { fs } from './fs'

export interface JSONCache<T = any> {
  path: string
  dirty: boolean
  get(key: string): T
  set(key: string, value: T | null): void
  find(fn: (value: T, key: string) => boolean): T
}

interface ManagedJSONCache<T = any> extends JSONCache<T> {
  save(): void
}

const caches: { [cachePath: string]: ManagedJSONCache } = {}
exitHook(() => Object.values(caches).forEach(cache => cache.save()))

export function loadCache<T>(
  cachePath: string,
  onLoad?: (cache: JSONCache<T>) => void
): JSONCache<T> {
  let cache: ManagedJSONCache<T> = caches[cachePath]
  if (cache) {
    return cache
  }
  let data: any
  try {
    data = fs.readJson(cachePath)
  } catch (err: any) {
    if (err.code == fs.NOT_REAL) {
      data = {}
    } else {
      throw err
    }
  }
  let dirty = false
  cache = caches[cachePath] = {
    get path() {
      return cachePath
    },
    get dirty() {
      return dirty
    },
    get: key => data[key],
    set(key, value) {
      if (value) data[key] = value
      else delete data[key]

      if (!dirty) {
        dirty = true
        setImmediate(this.save)
      }
    },
    save() {
      if (dirty) {
        fs.mkdir(dirname(cachePath))
        fs.write(cachePath, JSON.stringify(data, null, 2))
        dirty = false
      }
    },
    find(fn) {
      const key = Object.keys(data).find(key => fn(data[key], key))
      return key != null ? data[key] : undefined
    },
  }
  onLoad?.(cache)
  return cache
}
