import AsyncTaskGroup from 'async-task-group'
import log from 'lodge'
import { relative } from 'path'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { fatal, spin } from '../core/helpers'
import { loadPackages } from '../core/loadPackages'

export default async (cfg: RootConfig) => {
  const args = slurm({
    concurrency: { type: 'number', default: 3 },
  })
  if (!args[0]) {
    fatal('Must provide a script name')
  }

  const packages = loadPackages(cfg.root, {
    skip: cfg.vendor,
  })

  const spinner = spin('Running...')

  const runner = new AsyncTaskGroup(args.concurrency)
  await runner.map(Object.values(packages), async pkg => {
    const script = pkg.manager.run(args[0])
    if (script) {
      try {
        await script
        spinner.log(
          log.green('✓'),
          'Run completed for',
          log.green('./' + relative(cfg.root, pkg.root))
        )
      } catch {
        spinner.log(
          log.red('⨯'),
          'Build failed:',
          log.yellow('./' + relative(cfg.root, pkg.root))
        )
      }
    }
  })
  spinner.stop()
}