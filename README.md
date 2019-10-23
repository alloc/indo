# indo

Workspaces where each package has its own commit history.

Setup your monorepo with one command:

```sh
npx indo
```

## Synopsis

Monorepos are great for keeping a bundle of packages tied together by a commit history, but sometimes a package needs (or already has) its own commit history. For example, you might be developing a fork of someone else's package. Indo lets you choose which packages deserve their own commit history. Just run `git clone` and Indo will notice. **Note:** Be sure to add your clones to `.gitignore` to avoid [git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules) (which are *not* supported by Indo).

Indo automatically searches your monorepo for `package.json` files, which means it can be used with **zero setup**. The `indo` command will (1) create the `.indo.json` if none is found, (2) clone any missing repos, (3) install dependencies, (4) run `build` scripts, and (5) link local packages together.

**Fun facts:**

- Indo *never* hoists dependencies
- Indo plays nicely with Yarn workspaces
- Indo makes forking a breeze

&nbsp;

## Guides

- [Bootstrap Your Packages](./docs/bootstrap.md)
- [Using A Temporary Fork](./docs/using-a-temporary-fork.md)
- [Using Vendor Packages](./docs/using-vendor.md)

&nbsp;

## Commands

### `indo`

Run this command to bootstrap your Indo-powered monorepo, which involves
cloning any missing repos, installing any dependencies, and linking together your
local packages.

&nbsp;

### `indo help`

Print documentation for a specific command.

```sh
# What does "indo clone" do?
indo clone help
```

Aliases: `-h`, `--help`

&nbsp;

### `indo clone`

Shallow clone a repository and add it to "repos" in the nearest `.indo.json` config.

You can even provide a package name instead of a git url! For example, `indo clone lodash`
asks npm for the git url and clones it into `vendor/lodash` by default. You can also pass
an optional directory name (eg: `indo clone lodash a/b/c`).

&nbsp;

### `indo exec`

Run an arbitrary command in every non-vendor package.

**Note:** Piping is not yet supported.

```sh
indo exec -- echo \$PACKAGE_NAME
```

Injected variables include:
- `PACKAGE_NAME`
- `PACKAGE_ROOT`

&nbsp;

### `indo git`

Run a `git` command in every `.git` repo containing a non-vendor package.

**Note:** Your customized `git` aliases are supported!

```sh
indo git status
```

&nbsp;

### `indo run`

Run a npm script in every non-vendor package.

```sh
indo run build
```

&nbsp;

### `indo ls`

See which packages are detected by Indo.

```sh
indo ls
```

&nbsp;

### `indo rm`

Remove one or more packages, cleaning up `.indo.json` along the way.

For example, `indo rm foo bar` removes the `./foo` and `./bar` directories (relative to the current directory) from the filesystem and from the nearest `.indo.json` file.

The given directories are not required to contain a `package.json`. For example, you can do `indo rm packages`
to delete the entire `packages` directory, which may contain dozens of repos, each with its own `package.json`. Indo re-installs the dependencies of any non-vendor package that was linked to a removed package.

It's basically `rm -rf` but with:
- a confirmation prompt
- automatic updates to the nearest `.indo.json` file

&nbsp;

### `indo init`

Create an empty `.indo.json` file in the current directory, replacing any pre-existing `.indo.json` file.

The `indo` command automatically invokes this command when neither the current directory nor any of
its ancestors contain a `.indo.json` file.
