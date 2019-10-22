import AsyncTaskGroup from 'async-task-group'
import log from 'lodge'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { fatal } from '../core/helpers'
import { loadPackages } from '../core/loadPackages'

export default async (cfg: RootConfig) => {
  const args = slurm({
    concurrency: { type: 'number', default: 1 },
  })
  const cmd = args['--']
  if (!cmd) {
    return fatal(
      'No command given (eg:',
      log.lgreen('"indo run -- echo \\$PACKAGE_NAME"') + ')'
    )
  }
  console.log(args)
  const packages = loadPackages(cfg.root, {
    skip: cfg.vendor,
  })

  const runner = new AsyncTaskGroup(args.concurrency)
  await runner.map(Object.values(packages), async pkg => {
    await pkg.exec(
      cmd,
      {
        env: {
          ...process.env,
          PACKAGE_NAME: pkg.name,
          PACKAGE_ROOT: pkg.root,
          FORCE_COLOR: 'true',
        },
      },
      (stderr, stdout) => {
        if (stderr) process.stderr.write(stderr)
        else process.stdout.write(stdout)
      }
    )
  })
}
