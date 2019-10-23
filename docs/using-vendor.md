# Using Vendor Packages

"Vendor packages" are npm packages that match any glob in the "vendor" array (for more info, see ["Configuration"](./config.md)). These packages **never** have their dependencies installed (or their build scripts executed) when running the `indo` command. But they are still linked to as dependencies of non-vendor packages.

This is useful when working on other dependencies that don't belong in the commit history of your monorepo (not even in its `.indo.json` file). For example, you could be developing a new feature in a dependency and testing your changes within your monorepo.

To use vendor packages, use `git clone` or `ln -s` inside the `./vendor/` directory to add your repositories. When all of your clones are ready, run the `indo` command to link them to your non-vendor packages. It's that easy!

Another option is to use `indo link`. More info [here](./using-yarn-link.md).

### Monorepos

You can even clone a monorepo into the `./vendor/` directory. Right now, only Yarn workspaces are supported, but Lerna support will be added eventually. The `indo` command uses the `"workspaces"` glob array in each monorepo's `package.json` file to find more vendor packages.

### Linking between vendors

Unfortunately, a vendor package **cannot** be automatically linked to another vendor package, as this would break the promise that we never touch the dependencies of vendor packages.

As a workaround, you'll have to link the vendor packages together manually. If the vendor package is a symlink leading outside the monorepo, you should clone it before making changes, so you don't break other monorepos linked to the vendor package (if that's a concern).
