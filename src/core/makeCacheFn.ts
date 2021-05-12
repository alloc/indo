const caches = new WeakMap<object, Map<Function, any>>()

export const makeCacheFn = <T extends (...args: any[]) => any>(
  key: object,
  fun: T
) => (...args: Parameters<T>): ReturnType<T> => {
  let cache = caches.get(key)
  if (!cache) {
    cache = new Map()
    caches.set(key, cache)
  }
  let result = cache.get(fun)
  if (!result) {
    result = fun(...args)
    cache.set(fun, result)
  }
  return result
}
