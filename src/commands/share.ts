import { prompt } from 'enquirer'
import Enquirer = require('enquirer')
import { join, relative } from 'path'
import { RootConfig, saveConfig } from '../core/config'
import { git } from '../core/git'
import { fatal, log } from '../core/helpers'
import { loadVendors } from '../core/loadVendors'

type RepoMap = {
  [gitRoot: string]: {
    root: string
    url: string
    head?: string
  }
}

export default async (cfg: RootConfig) => {
  const repos: RepoMap = {}
  const choices: Enquirer.Prompt.Choice[] = []

  const packages = loadVendors(cfg)
  for (const pkg of Object.values(packages)) {
    const gitRoot = git.findRoot(pkg.root)
    if (!gitRoot || gitRoot === cfg.root) {
      continue
    }
    if (!repos[gitRoot]) {
      if (cfg.repos[gitRoot]) {
        log('In tracked repo: %O', gitRoot)
        continue
      }
      const root = relative(cfg.root, gitRoot)
      if (!repos[root]) {
        const url = git.getRemoteUrl(gitRoot)
        const head = git.getActiveBranch(gitRoot)
        repos[root] = { root, url, head }
        choices.push({
          name: root,
          hint:
            log.gray(' - ' + url.replace(/^https:\/\//, '')) +
            (head == 'master' ? '' : log.lyellow(' ' + head)),
        })
      }
    }
  }

  if (!choices.length) {
    return fatal('No vendor packages were found.')
  }

  const { selected } = await prompt<{ selected: string[] }>({
    name: 'selected',
    type: 'autocomplete',
    message: 'Choose which repos to share',
    choices,
    multiple: true,
  })

  for (const root of selected) {
    const remotes = git.getRemotes(join(cfg.root, root))
    const { url } = await prompt<{ url: string }>({
      name: 'url',
      type: 'select',
      message: 'Choose the fetch url',
      choices: remotes.map(remote => remote.url),
    })

    const { head } = repos[root]
    cfg.repos[root] = { url, head }
    saveConfig(cfg)
  }
}
