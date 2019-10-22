import exec from '@cush/exec'
import bocks from 'bocks'
import log from 'lodge'
import { join } from 'path'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { git } from '../core/git'
import { loadPackages } from '../core/loadPackages'

export default async function(cfg: RootConfig) {
  const cmd = slurm('*')._
  const packages = loadPackages(cfg.root, {
    skip: cfg.vendor,
  })

  const gitRoots = Array.from(git.findRoots(cfg, Object.values(packages)))

  // Assume "cfg.root" is a git repo
  gitRoots.unshift('')

  for (const rootId of Array.from(gitRoots)) {
    log(bocks(log.bold('./' + rootId)).replace(bocks.RE, log.coal('$1')))
    log('')
    await exec('git ' + cmd, {
      cwd: join(cfg.root, rootId),
      stdio: 'inherit',
    })
    log('')
  }
}