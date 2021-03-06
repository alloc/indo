import shell from '@cush/shell'
import fs from 'saxon/sync'

/**
 * Clone a git repository with sparse checkout.
 */
export function sparseClone(
  dest: string,
  url: string,
  branch: string,
  subpath: string
) {
  fs.mkdir(dest)
  return shell(
    `git clone ${url} . -b ${branch} --no-checkout --depth 1
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
