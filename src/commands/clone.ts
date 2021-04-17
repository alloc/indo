import exec from '@cush/exec'
import { join, relative, resolve } from 'path'
import slurm from 'slurm'
import { fs } from '../core/fs'
import { git } from '../core/git'
import {
  cwdRelative,
  cyan,
  fatal,
  gray,
  green,
  log,
  randstr,
  startTask,
  success,
} from '../core/helpers'

import { saveConfig, RootConfig } from '../core/config'
import { loadPackage } from '../core/Package'
import { indo } from './default'

export default async (cfg: RootConfig) => {
  const args = slurm({
    branch: { type: 'string' },
    b: 'branch',
  })

  let url = args[0]
  if (!url) {
    fatal('Must provide a git url or package name')
  }
  if (url[0] == '@' || url.indexOf('/') < 0) {
    const stdout = await exec(`npm show ${url} repository --json`)
    if (!stdout) {
      fatal('Found no "repository" in the published package.json')
    }
    const repo = JSON.parse(stdout)
    if (repo.type !== 'git') {
      fatal('Unsupported vcs:', repo.type)
    }
    url = repo.url.replace(/^git\+/, '')
  }

  let dir = args[1]
  const needsRename = !dir
  if (needsRename) {
    dir = join(cfg.root, 'vendor', 'tmp' + randstr(10))
    fs.mkdir(dir)
  } else {
    dir = resolve(dir)
  }

  const task = startTask('Cloning...')

  const repo = { url, head: args.branch }
  await git.clone(cfg.root, repo, dir)

  task.finish()

  const pkg = loadPackage(join(dir, 'package.json'))
  if (needsRename) {
    if (pkg && pkg.name) {
      dir = join(cfg.root, 'vendor', pkg.name)
      pkg.move(dir)
    } else {
      fs.remove(dir, true)
      fatal('Cannot infer package name when no "package.json" exists')
    }
  }

  log(
    green('+'),
    'Cloned',
    green(cwdRelative(dir)),
    'from',
    gray(url.replace(/^.+:\/\//, ''))
  )

  dir = relative(cfg.root, dir)
  cfg.repos[dir] = repo
  saveConfig(cfg)

  success('Updated "repos" in', cyan(cwdRelative(cfg.path)))

  await indo(cfg.root)
}
