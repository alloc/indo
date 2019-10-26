import AsyncTaskGroup from 'async-task-group'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { fatal, log } from '../core/helpers'
import { loadPackages } from '../core/loadPackages'

export default async (cfg: RootConfig) => {
  const args = slurm({
    concurrency: { type: 'number', default: 1 },
  })

  const cmd = args['--']
  if (!cmd) {
    throw fatal(
      'No command given (eg:',
      log.lgreen('"indo run -- echo \\$PACKAGE_NAME"') + ')'
    )
  }

  const packages = loadPackages(cfg.root, {
    skip: cfg.vendor,
  })

  const runner = new AsyncTaskGroup(args.concurrency)
  await runner.map(Object.values(packages), async pkg => {
    const env = {
      ...process.env,
      PWD: pkg.root,
      PACKAGE_NAME: pkg.name,
      PACKAGE_ROOT: pkg.root,
    }
    await pkg.exec(injectEnv(cmd, env), {
      env,
      stdio: 'inherit',
    })
  })
}

function injectEnv(cmd: string, env: object) {
  const envUnixRegex = /\$(\w+)/g
  return cmd.replace(envUnixRegex, (_, name) => {
    return env[name] || ''
  })
}
