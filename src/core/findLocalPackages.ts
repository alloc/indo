import { join } from 'path'
import { dotIndoId, loadConfig, RootConfig } from './config'
import { findPackages } from './findPackages'
import { fs } from './fs'

/**
 * Find local packages for an `.indo.json` root.
 *
 * Vendor packages and nested roots are ignored.
 */
export function findLocalPackages(cfg: RootConfig) {
  // Find packages in the root repository.
  const packagePaths = findPackages(cfg.root, cfg.ignore)

  // Find packages in nested repostories.
  Object.keys(cfg.repos).forEach(repoDir => {
    const absRepoDir = join(cfg.root, repoDir)

    // Nested roots are skipped since they load themselves.
    if (loadConfig(join(absRepoDir, dotIndoId))) return
    // Linked repos are skipped since they are readonly.
    if (fs.isLink(absRepoDir)) return

    // Ensure globs targeting a specific repo can be used.
    const ignore = cfg.ignore.map(glob =>
      glob.startsWith(repoDir + '/') ? glob.slice(repoDir.length) : glob
    )

    findPackages(absRepoDir, ignore).forEach(pkgPath => {
      packagePaths.push(pkgPath)
    })
  })

  return packagePaths
}
