import { join } from 'path'
import { loadCache } from './cache'
import { RootConfig } from './config'
import { CACHE_DIR } from './helpers'

export function getPromptMemory(cfg: RootConfig) {
  return loadCache<any>(join(cfg.root, CACHE_DIR, 'prompts.json'), cache => {
    cache.find((_, key) => {
      if (key.startsWith('no-clone:')) {
        const path = key.slice(9)
        const repo = cfg.repos[path]
        if (!repo || !repo.optional) {
          cache.set(key, null)
        }
      }
      return false
    })
  })
}
