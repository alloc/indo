import * as Path from 'path'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { fs } from '../core/fs'
import {
  confirm,
  cwdRelative,
  cyan,
  fatal,
  getRelativeId,
  gray,
  green,
  success,
} from '../core/helpers'
import { loadPackage, toPackagePath } from '../core/Package'
import { indo } from './default'

export default async (cfg: RootConfig) => {
  const args = slurm()

  let [oldName, newName] = args
  oldName = Path.resolve(oldName)
  newName = Path.resolve(newName)

  const pkg = loadPackage(toPackagePath(oldName))
  if (!pkg) {
    return fatal(
      'Cannot move non-existent path: ' + green(cwdRelative(oldName))
    )
  }

  const shouldBail =
    fs.exists(newName) &&
    !(await confirm('New path already exists. Overwrite?'))

  if (!shouldBail) {
    pkg.move(newName)
    success(
      'Moved package:',
      gray(cwdRelative(oldName)),
      '➝',
      green(cwdRelative(newName))
    )

    const oldId = getRelativeId(cfg.root, oldName)
    const newId = getRelativeId(cfg.root, newName)

    if (cfg.repos[oldId]) {
      cfg.repos[newId] = cfg.repos[oldId]
      delete cfg.repos[oldId]
      saveConfig(cfg)
      success('Updated "repos" in', cyan('.indo.json'))
    }

    await indo(cfg.root)
  }
}
