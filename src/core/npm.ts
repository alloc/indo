import exec from '@cush/exec'
import { join } from 'path'
import fs from 'saxon/sync'
import { Package } from './Package'

interface Config {
  name: string
  lock: string
  commands: {
    install: string
    run: string
  }
}

export class PackageManager {
  name!: string
  lock!: string
  commands!: Config['commands']

  constructor(readonly pkg: Package, config: Config) {
    Object.assign(this, config)
  }

  install(...args: exec.Args) {
    return this.pkg.exec(this.commands.install, ...args)
  }

  run(name: string, ...args: exec.Args) {
    const { scripts } = this.pkg
    if (scripts && scripts[name]) {
      return this.pkg.exec(this.commands.run, [name], ...args)
    }
  }
}

const configs: Config[] = [
  {
    name: 'yarn',
    lock: 'yarn.lock',
    commands: {
      install: 'yarn',
      run: 'yarn run',
    },
  },
  {
    name: 'npm',
    lock: 'package-lock.json',
    commands: {
      install: 'npm install',
      run: 'npm run',
    },
  },
  {
    name: 'pnpm',
    lock: 'pnpm-lock.yaml',
    commands: {
      install: 'pnpm install',
      run: 'pnpm run',
    },
  },
]

const yarn = {
  ...configs[0],
  commands: {
    // Never create a lockfile where none exists.
    install: 'yarn --no-lockfile',
    run: 'yarn run',
  },
}

export function getPackageManager(pkg: Package) {
  for (const config of configs) {
    const lockfilePath = join(pkg.root, config.lock)
    if (fs.isFile(lockfilePath)) {
      return new PackageManager(pkg, config)
    }
  }
  return new PackageManager(pkg, yarn)
}
