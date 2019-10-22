import log from 'lodge'
import { relative, resolve } from 'path'
import fs from 'saxon/sync'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { confirm } from '../core/helpers'

export default async function(cfg: RootConfig) {
  let changed = false
  for (let path of slurm()) {
    path = relative(cfg.root, resolve(path))
    if (cfg.repos[path]) {
      delete cfg.repos[path]
      changed = true
    } else {
      const len = cfg.vendor.length
      cfg.vendor = cfg.vendor.filter(glob => {
        return glob !== path && !glob.startsWith(path + '/')
      })
      if (len > cfg.vendor.length) {
        changed = true
      }
    }
    if (await confirm(`Delete ${log.yellow('./' + path)} forever?`)) {
      fs.remove(path, true)
    }
  }
  if (changed) {
    saveConfig(cfg)
  }
}
