import * as Path from 'path'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { fs } from '../core/fs'
import {
  confirm,
  cwdRelative,
  fatal,
  getRelativeId,
  log,
} from '../core/helpers'
import { linkPackages } from '../core/linkPackages'
import { loadPackage } from '../core/Package'

export default async (cfg: RootConfig) => {
  const args = slurm()

  let [oldName, newName] = args
  oldName = Path.resolve(oldName)
  newName = Path.resolve(newName)

  const pkg = loadPackage(Path.join(oldName, 'package.json'))
  if (!pkg) {
    return fatal(
      'Cannot move non-existent path: ' + log.green(cwdRelative(oldName))
    )
  }

  const shouldBail =
    fs.exists(newName) &&
    !(await confirm('New path already exists. Overwrite?'))

  if (!shouldBail) {
    pkg.move(newName)
    log(
      log.green('✓'),
      'Moved package:',
      log.gray(cwdRelative(oldName)),
      '➝',
      log.green(cwdRelative(newName))
    )

    const oldId = getRelativeId(cfg.root, oldName)
    const newId = getRelativeId(cfg.root, newName)

    if (cfg.repos[oldId]) {
      cfg.repos[newId] = cfg.repos[oldId]
      delete cfg.repos[oldId]
      saveConfig(cfg)
      log(log.green('✓'), 'Updated "repos" in', log.lcyan('.indo.json'))
    }

    linkPackages(cfg)
  }
}
