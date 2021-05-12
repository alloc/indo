import exec from '@cush/exec'
import bocks from 'bocks'
import { bold, gray } from 'kleur'
import { join } from 'path'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { git } from '../core/git'
import { cwdRelative, log } from '../core/helpers'
import { loadLocalPackages } from '../core/loadLocalPackages'

export default async (cfg: RootConfig) => {
  const cmd = slurm('*')._

  const packages = loadLocalPackages(cfg)
  const gitRoots = Array.from(git.findRoots(cfg, Object.values(packages)))

  // Assume "cfg.root" is a git repo
  gitRoots.unshift('')

  for (const rootId of Array.from(gitRoots)) {
    log(
      bocks(bold(cwdRelative(join(cfg.root, rootId)))).replace(
        bocks.RE,
        gray('$1')
      )
    )
    log('')
    await exec('git ' + cmd, {
      cwd: join(cfg.root, rootId),
      stdio: 'inherit',
    })
    log('')
  }
}
