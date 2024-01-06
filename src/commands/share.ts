import { warn } from 'misty'
import { join, relative, resolve } from 'path'
import prompt, { Choice } from 'prompts'
import slurm from 'slurm'
import { RootConfig, saveConfig } from '../core/config'
import { fs } from '../core/fs'
import { git } from '../core/git'
import { fatal, gray, log, yellow } from '../core/helpers'
import { loadVendors } from '../core/loadVendors'

type RepoMap = {
  [gitRoot: string]: {
    root: string
    url: string
    head?: string
  }
}

export default async (cfg: RootConfig) => {
  const gitRoots: string[] = []
  const args = slurm()

  const isExplicit = args.length > 0
  if (isExplicit) {
    for (const name of args) {
      const gitRoot = resolve(name)
      if (fs.exists(join(gitRoot, '.git'))) {
        gitRoots.push(gitRoot)
      } else {
        warn(`"${name}" has no .git folder`)
      }
    }
  } else {
    const packages = loadVendors(cfg)
    for (const pkg of Object.values(packages)) {
      const gitRoot = git.findRoot(pkg.root)
      if (gitRoot && gitRoot !== cfg.root) {
        gitRoots.push(gitRoot)
      }
    }
  }

  if (!gitRoots.length) {
    if (isExplicit) {
      return log('Nothing to do.')
    }
    fatal('No vendor packages were found.')
  }

  const repos: RepoMap = {}
  const choices: Choice[] = []

  for (const gitRoot of gitRoots) {
    if (repos[gitRoot]) {
      continue
    }
    if (cfg.repos[gitRoot]) {
      log('In tracked repo: %O', gitRoot)
      continue
    }
    const root = relative(cfg.root, gitRoot)
    if (!repos[root]) {
      const url = git.getRemoteUrl(gitRoot)
      const head = git.getActiveBranch(gitRoot)
      repos[root] = { root, url, head }
      if (!isExplicit)
        choices.push({
          title: root,
          value: root,
          description:
            gray(' - ' + url.replace(/^https:\/\//, '')) +
            (head == 'master' ? '' : yellow(' ' + head)),
        })
    }
  }

  type Answer = { selected: string[] }
  const { selected }: Answer = isExplicit
    ? { selected: Object.keys(repos) }
    : await prompt({
        name: 'selected',
        type: 'autocompleteMultiselect',
        message: 'Choose which repos to share',
        choices,
      })

  if (!selected) {
    return
  }

  for (const root of selected) {
    const remotes = git.getRemotes(join(cfg.root, root))

    type Answer = { url: string }
    const { url }: Answer = await prompt({
      name: 'url',
      type: 'select',
      message: 'Choose the fetch url',
      choices: remotes.map(remote => ({
        title: remote.url,
        value: remote.url,
      })),
    })

    const { head } = repos[root]
    cfg.repos[root] = { url, head }
    saveConfig(cfg)
  }
}
