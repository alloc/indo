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
    remove: string
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
    return this.pkg.exec(cmd, [...names, ...argv], ...args)
  }

  remove(names: string[], ...args: exec.Args) {
    return this.pkg.exec(this.commands.remove, names, ...args)
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
      remove: 'yarn remove',
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
      remove: 'npm uninstall',
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
      remove: 'pnpm remove',
    },
  },
]

const yarn = configs[0]
const defaultYarn: Config = {
  ...yarn,
  commands: {
    ...yarn.commands,
    // Never create a lockfile where none exists.
    install: 'yarn --no-lockfile',
    add: opts => {
      const args = yarn.commands.add(opts)
      args[1].push('--no-lockfile')
      return args
    },
  },
}

export function getPackageManager(pkg: Package) {
  for (const config of configs) {
    const lockfilePath = join(pkg.root, config.lock)
    if (fs.isFile(lockfilePath)) {
      return new PackageManager(pkg, config)
    }
  }
  return new PackageManager(pkg, defaultYarn)
}
