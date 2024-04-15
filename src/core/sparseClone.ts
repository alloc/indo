import shell from '@cush/shell'
import fs from 'saxon/sync'

/**
 * Clone a git repository with sparse checkout.
 */
export function sparseClone(
  dest: string,
  url: string,
  branch: string | undefined,
  commit: string | undefined,
  subpath: string | undefined
) {
  fs.mkdir(dest)
  let checkoutCommand = `git clone ${url} . --no-checkout --depth 1`
  if (commit) {
    checkoutCommand += ` && git checkout ${commit}`
  } else if (branch) {
    checkoutCommand += ` -b ${branch}`
  }
  return shell(
    `${checkoutCommand}
     git config core.sparseCheckout true
     echo "${subpath}" >> .git/info/sparse-checkout
     git checkout
     git mv "${subpath}" .sparse-tmp
     rm -rf "${subpath.split('/')[0]}"
     git mv .sparse-tmp/* .
     rm -r .sparse-tmp`,
    { cwd: dest }
  )
}
