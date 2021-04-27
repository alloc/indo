import AsyncTaskGroup from 'async-task-group'
import slurm from 'slurm'
import {
  cwdRelative,
  fatal,
  green,
  log,
  red,
  startTask,
  success,
  yellow,
} from '../core/helpers'

import { RootConfig } from '../core/config'
import { loadPackages } from '../core/loadPackages'
import { findLocalPackages } from '../core/findLocalPackages'

export default async (cfg: RootConfig) => {
  const args = slurm({
    concurrency: { type: 'number', default: 3 },
  })
  if (!args[0]) {
    fatal('Must provide a script name')
  }

  const packages = loadPackages(findLocalPackages(cfg))
  const task = startTask('Running...')

  const runner = new AsyncTaskGroup(args.concurrency)
  await runner.map(Object.values(packages), async pkg => {
    const script = pkg.manager.run(args[0])
    if (script) {
      try {
        await script
        success('Run completed for', green(cwdRelative(pkg.root)))
      } catch {
        log(red('⨯'), 'Build failed:', yellow(cwdRelative(pkg.root)))
      }
    }
  })

  task.finish()
}
