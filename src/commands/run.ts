import AsyncTaskGroup from 'async-task-group'
import log from 'lodge'
import ora from 'ora'
import { relative } from 'path'
import slurm from 'slurm'
import { RootConfig } from '../core/config'
import { fatal } from '../core/helpers'
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

  let spinner!: ora.Ora
  let start = () => (spinner = ora('Running...').start())
  start()

  const runner = new AsyncTaskGroup(args.concurrency)
  await runner.map(Object.values(packages), async pkg => {
    const script = pkg.manager.run(args[0])
    if (script) {
      try {
        await script
        spinner.stop()
        log(
          log.green('✓'),
          'Run completed for',
          log.green('./' + relative(cfg.root, pkg.root))
        )
      } catch {
        spinner.stop()
        log(
          log.red('⨯'),
          'Build failed:',
          log.yellow('./' + relative(cfg.root, pkg.root))
        )
      } finally {
        start()
      }
    }
  })
  spinner.stop()
}
