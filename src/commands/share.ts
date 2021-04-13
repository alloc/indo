import { join, relative } from 'path'
import prompt, { Choice } from 'prompts'
import { RootConfig, saveConfig } from '../core/config'
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
  const repos: RepoMap = {}
  const choices: Choice[] = []

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
          title: root,
          value: root,
          description:
            gray(' - ' + url.replace(/^https:\/\//, '')) +
            (head == 'master' ? '' : yellow(' ' + head)),
        })
      }
    }
  }

  if (!choices.length) {
    return fatal('No vendor packages were found.')
  }

  type Answer = { selected: string[] }
  const { selected }: Answer = await prompt({
    name: 'selected',
    type: 'autocompleteMultiselect',
    message: 'Choose which repos to share',
    choices,
  })

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
