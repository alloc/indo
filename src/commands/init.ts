import fs from 'saxon/sync'
import { loadConfig } from '../core/config'
import { log, tildify } from '../core/helpers'

export default () => {
  fs.write('.indo.json', '{}')
  log(
    log.green('✓'),
    'Created',
    log.lgreen('.indo.json'),
    'in',
    log.gray(tildify(process.cwd()))
  )
  return loadConfig()
}
