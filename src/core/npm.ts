import exec from '@cush/exec'
import { join } from 'path'
import fs from 'saxon/sync'
import { Package } from './Package'

interface AddOptions {
  prod?: boolean
  dev?: boolean
  optional?: boolean
  peer?: boolean
  exact?: boolean
}

interface Config {
  name: string
  lock: string
  commands: {
    install: string
    run: string
    add: (opts: AddOptions) => [string, exec.Argv]
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

  add(names: string[], opts: AddOptions, ...args: exec.Args) {
    const [cmd, argv] = this.commands.add(opts)
    return this.pkg.exec(cmd, [...names, ...argv])
  }
}

const configs: Config[] = [
  {
    name: 'yarn',
    lock: 'yarn.lock',
    commands: {
      install: 'yarn',
      run: 'yarn run',
      add: opts => [
        'yarn add',
        [
          opts.exact ? '--exact' : null,
          opts.dev
            ? '--dev'
            : opts.optional
            ? '--optional'
            : opts.peer
            ? '--peer'
            : null,
        ],
      ],
    },
  },
  {
    name: 'npm',
    lock: 'package-lock.json',
    commands: {
      install: 'npm install',
      run: 'npm run',
      add: opts => [
        'npm install',
        [
          opts.exact ? '-E' : null,
          opts.dev ? '-D' : opts.optional ? '-O' : null,
        ],
      ],
    },
  },
  {
    name: 'pnpm',
    lock: 'pnpm-lock.yaml',
    commands: {
      install: 'pnpm install',
      run: 'pnpm run',
      add: opts => [
        'pnpm add',
        [
          opts.exact ? '-E' : null,
          opts.dev
            ? '-D'
            : opts.optional
            ? '-O'
            : opts.peer
            ? '--save-peer'
            : null,
        ],
      ],
    },
  },
]

const yarn = {
  ...configs[0],
  commands: {
    ...configs[0].commands,
    // Never create a lockfile where none exists.
    install: 'yarn --no-lockfile',
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
