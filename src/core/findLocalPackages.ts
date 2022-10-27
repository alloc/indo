import { realpathSync } from 'fs'
import { join } from 'path'
import { RootConfig } from './config'
import { findPackages } from './findPackages'
import { isSelfManaged } from './helpers'

/**
 * Find local packages for an `.indo.json` root.
 *
 * Vendor packages and nested roots are ignored.
 */
export function findLocalPackages(cfg: RootConfig) {
  // Find packages in the root repository.
  const packagePaths = new Set(
    findPackages(cfg.root, cfg.ignore).map(pkgPath => realpathSync(pkgPath))
  )

  // Find packages in nested repostories.
  Object.keys(cfg.repos).forEach(repoDir => {
    const absRepoDir = join(cfg.root, repoDir)
    if (isSelfManaged(absRepoDir)) return

    // Ensure globs targeting a specific repo can be used.
    const ignore = cfg.ignore.map(glob =>
      glob.startsWith(repoDir + '/') ? glob.slice(repoDir.length) : glob
    )

    findPackages(absRepoDir, ignore).forEach(pkgPath => {
      packagePaths.add(realpathSync(pkgPath))
    })
  })

  return [...packagePaths]
}
