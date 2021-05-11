import { join } from 'path'
import toml from 'markty-toml'
import { JSONCache, loadCache } from './cache'
import { RepoConfig } from './config'
import { fs } from './fs'
import { CACHE_DIR } from './helpers'

export interface LinkMetaData {
  /** The repository metadata */
  repo: RepoConfig
  /** The latest modified time between `.git/HEAD` and `.git/config` */
  mtime: number
}

/**
 * The **link manifest** tracks all repositories that both (1) were added
 * with `indo link` and (2) are tracking an upstream repository.
 */
export function loadLinkManifest(root: string, skipUpdate?: boolean) {
  return loadCache<LinkMetaData>(
    join(root, CACHE_DIR, 'links.json'),
    skipUpdate ? undefined : updateLinkManifest
  )
}

export function updateLinkManifest(links: JSONCache<LinkMetaData>) {
  links.find((link, linkPath) => {
    if (fs.isLink(linkPath)) {
      const newLink = loadLinkMetaData(linkPath, link)!
      if (newLink) {
        newLink == link || links.set(linkPath, newLink)
        return false
      }
    }
    links.set(linkPath, null)
    return false
  })
}

export function loadLinkMetaData(
  linkPath: string,
  prevData?: LinkMetaData
): LinkMetaData | undefined {
  const gitHeadPath = join(linkPath, '.git/HEAD')
  const gitConfigPath = join(linkPath, '.git/config')
  try {
    const mtime = Math.max(
      fs.stat(gitHeadPath).mtimeMs,
      fs.stat(gitConfigPath).mtimeMs
    )
    if (prevData && mtime == prevData.mtime) {
      return prevData
    }
    const gitHead = toml(fs.read(gitHeadPath)) as { ref: string }
    const gitConfig = readGitConfig(gitConfigPath)
    if (gitHead.ref.startsWith('refs/heads/')) {
      const head = gitHead.ref.slice(11)
      if (gitConfig.heads[head]) {
        const { remote, merge } = gitConfig.heads[head]
        return {
          mtime,
          repo: {
            url: gitConfig.remotes[remote],
            head: merge,
          },
        }
      }
    }
  } catch {}
}

function readGitConfig(gitConfigPath: string) {
  const data = toml(fs.read(gitConfigPath))
  const remotes: { [name: string]: string } = {}
  const heads: { [name: string]: { remote: string; merge: string } } = {}
  for (let key in data) {
    const value = data[key]
    if (key.startsWith('remote ')) {
      key = key.slice(8, -1)
      remotes[key] = value.url
    } else if (key.startsWith('branch ')) {
      key = key.slice(8, -1)
      value.merge = value.merge.replace(/^refs\/heads\//, '')
      heads[key] = value
    }
  }
  return {
    remotes,
    heads,
  }
}
