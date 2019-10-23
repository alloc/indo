import { dirname, join } from 'path'
import { isHomeDir } from './helpers'
import { loadPackage } from './Package'

export const getNearestPackage = (root: string) => {
  while (!isHomeDir(root)) {
    const pkg = loadPackage(join(root, 'package.json'))
    if (pkg) {
      return pkg
    }
    root = dirname(root)
  }
}
