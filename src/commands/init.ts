import { loadConfig } from '../core/config'
import { fs } from '../core/fs'
import { cyan, success, tildify } from '../core/helpers'

export default () => {
  fs.write('.indo.json', '{}')
  success('Created', cyan('.indo.json'), 'in', tildify(process.cwd()))
  return loadConfig()
}
