import log from 'lodge'
import { relative, resolve } from 'path'
import fs from 'saxon/sync'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { confirm } from '../core/helpers'

export default async function(cfg: RootConfig) {
  let changed = false
  for (let root of slurm()) {
    root = resolve(root)

    const rootDir = relative(cfg.root, root)
    if (!fs.isDir(rootDir)) {
      log.error(`Expected ${log.lpink(rootDir)} to be a directory`)
      continue
    }

    // Confirm deletion
    const ok = await confirm(`Delete ${log.yellow('./' + root)} forever?`)
    if (!ok) continue

    // Delete from disk
    fs.remove(root, true)

    // Delete descendants from "repos"
    for (const repoPath in cfg.repos) {
      if (isDescendant(repoPath, root)) {
        delete cfg.repos[repoPath]
        changed = true
      }
    }

    // Delete descendants from "vendor"
    const len = cfg.vendor.length
    cfg.vendor = cfg.vendor.filter(glob => isDescendant(glob, root))
    if (len > cfg.vendor.length) {
      changed = true
    }
  }
  if (changed) {
    saveConfig(cfg)
  }
}

/** Returns true if `parent` is equal to (or a parent of) the `path` argument */
function isDescendant(path: string, parent: string) {
  return path === parent || path.startsWith(parent + '/')
}
