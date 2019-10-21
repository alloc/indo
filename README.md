# indo

Workspaces where each package has its own commit history.

## Synopsis

Monorepos are a great way to colocate packages being developed at the same time,
but having a single commit history isn't always ideal. For example, you might be
developing a fork of someone else's package. Indo lets you choose which packages
deserve their own commit history. All you gotta do is run `git init` or `git clone`
and Indo will respect that. Just be sure to add them to your `.gitignore` if you
don't want to deal with "git modules".

Indo automatically searches your monorepo for `package.json` so it can be used
with zero setup. With a single `indo` command, Indo will (1) clone any missing
repos, (2) install dependencies, and (3) link local packages together (without
changing any `package.json` files). That's all you need to get started in an
Indo-powered monorepo.

Indo even plays nicely with other monorepos! For example, let's say you have a
monorepo all set up elsewhere on your computer. Simply link it to the special
`./vendor/` directory. Packages found in `./vendor/` are linked to by your own
packages, but Indo never touches their dependencies (again, assuming the monorepo
is already set up). **Note:** By design, Indo never does dependency hoisting.

## Commands

### `indo`

Run this command to bootstrap your Indo-powered monorepo, which involves
cloning any missing repos, installing any dependencies, and linking together your
local packages.

&nbsp;

### `indo clone`

Shallow clone a repository and add it to "repos" in the nearest `.indo.json` config.

You can even provide a package name instead of a git url! For example, `indo clone lodash`
asks npm for the git url and clones it into `packages/lodash` by default. You can also pass
an optional directory name (eg: `indo clone lodash a/b/c`).

&nbsp;

### `indo init`

Create a `.indo.json` config in the current directory.

&nbsp;

## Configuration

The `.indo.json` config may contain these properties.

- `alias?: object`
- `repos?: object`
- `vendor?: string[]`

The `alias` object works just like Yarn aliases, except only when linking local
packages together. For example, `"foo": "bar"` maps any local dependencies on
`foo` to `bar` **but only if** `bar` is a local package.

The `repos` object tells Indo where to clone from. The `indo` command will search
for unknown clones and offer to add them to `repos` for you. If you decline, they
will be added to `vendor` instead.

The `vendor` array tells Indo which globs to treat like external dependencies.
Any matching package never has its dependencies managed by Indo. No linking, no
installing. This defaults to `["vendor/**"]`.
