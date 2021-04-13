import { dotIndoId, loadConfig } from '../core/config'
import { fs } from '../core/fs'
import { cyan, success, tildify } from '../core/helpers'

export default () => {
  fs.write(dotIndoId, '{}')
  success('Created', cyan(dotIndoId), 'in', tildify(process.cwd()))
  return loadConfig(dotIndoId)
}
