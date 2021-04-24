import { dirname } from 'path'
import { isHomeDir } from './helpers'
import { loadPackage, toPackagePath } from './Package'

export const getNearestPackage = (root: string) => {
  while (!isHomeDir(root)) {
    const pkg = loadPackage(toPackagePath(root))
    if (pkg) {
      return pkg
    }
    root = dirname(root)
  }
}
