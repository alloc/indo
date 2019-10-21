import fs from 'saxon/sync'
import { loadConfig } from '../core/config'

export default () => {
  fs.write('.indo.json', '{}')
  return loadConfig()
}
