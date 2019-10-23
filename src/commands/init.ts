import log from 'lodge'
import fs from 'saxon/sync'
import { loadConfig } from '../core/config'

export default () => {
  fs.write('.indo.json', '{}')
  log(
    log.green('✓'),
    'Created',
    log.lgreen('.indo.json'),
    'in',
    log.gray(process.cwd())
  )
  return loadConfig()
}
