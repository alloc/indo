import slurm from 'slurm'
import { getNearestPackage } from '../core/getNearestPackage'
import { fatal } from '../core/helpers'

export default async () => {
  const args = slurm()
  if (!args.length) {
    throw fatal('Must give package names')
  }

  const pkg = getNearestPackage(process.cwd())
  if (!pkg) {
    throw fatal('Missing package.json')
  }

  const npm = pkg.manager
  try {
    await npm.remove(args.slice(), {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: 'true' },
    })
  } catch (err) {
    fatal(err)
  }
}
