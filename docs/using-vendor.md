# Using Vendor Packages

"Vendor packages" are JS packages that are matched by any glob in the "vendor" array (for more info, see ["Configuration"](./config.md)). These packages never have their dependencies installed (or their build scripts executed) when running the `indo` command. But they are still linked to as dependencies of non-vendor packages.

This is useful when you're working on a fix/feature to a dependency, so you don't want it automatically cloned when running the `indo` command. You don't want the package in git history at all, until the package is published.

To use vendor packages, use `git clone` or `ln -s` inside the `./vendor/` directory to add your repositories. When all of your clones are ready, run the `indo` command to link them to your non-vendor packages. It's that easy!

### Monorepos

You can even clone a monorepo into the `./vendor/` directory. Right now, only Yarn workspaces are supported, but Lerna support will be added eventually. The `indo` command uses the `"workspaces"` glob array in each monorepo's `package.json` file to find more vendor packages.
