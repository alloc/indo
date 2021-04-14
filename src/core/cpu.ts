import cpuCount from 'physical-cpu-count'

// Reserve a CPU for main thread.
let taken = 1
let queue: ((cpu: CPU) => void)[] = []

interface CPU {
  release(): void
}

export { cpuCount }

/** Wait until a CPU core is unused. */
export function requestCPU() {
  if (taken == cpuCount) {
    return new Promise<CPU>(resolve => queue.push(resolve))
  }
  taken++
  const cpu = {
    release() {
      if (queue.length) {
        queue.shift()!(cpu)
      } else {
        taken--
      }
    },
  }
  return Promise.resolve(cpu)
}
