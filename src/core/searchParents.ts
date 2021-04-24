import { dirname } from 'path'

/** Receive the next enclosing directory until a value is returned. */
export function searchParents<T>(
  root: string,
  cb: (dir: string) => T | undefined | void
) {
  root = dirname(root)
  for (;;) {
    const result = cb(root)
    if (result !== undefined) {
      return result
    }
    if (root == (root = dirname(root))) {
      return
    }
  }
}
