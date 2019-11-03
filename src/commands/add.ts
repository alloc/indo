import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { getNearestPackage } from '../core/getNearestPackage'
import { fatal, log } from '../core/helpers'
import { linkPackages } from '../core/linkPackages'

export default async (cfg: RootConfig) => {
  const args = slurm({
    prod: { type: 'boolean' },
    dev: { type: 'boolean' },
    optional: { type: 'boolean' },
    peer: { type: 'boolean' },
    exact: { type: 'boolean' },
    D: 'dev',
    O: 'optional',
    P: 'peer',
    E: 'exact',
  })
  if (!args.length) {
    throw fatal('Must give package names')
  }

  const pkg = getNearestPackage(process.cwd())
  if (!pkg) {
    throw fatal('Missing package.json')
  }

  const npm = pkg.manager
  try {
    await npm.add(args.slice(), args, {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: 'true' },
    })
  } catch (err) {
    fatal(err)
  }

  log('')
  linkPackages(cfg)
}