# Using `yarn link`

Similar to `yarn link`, Indo has `indo link` for easily exposing your monorepo to local packages that exist outside your monorepo's root directory.

Indo creates the `~/.indo` directory to store any registered packages. Try opening `~/.indo/registry.json` to see which packages have been linked in the past.

To add a package to the global registry, run `indo link` from inside it.

To use a global package, run `indo link <name>` in your Indo-powered monorepo. This adds a symlink to the `./vendor/` directory.

To stop using a global package, run `indo rm ./vendor/<name>` from your monorepo's root directory.

To remove a package from the global registry, run `indo unlink` from inside it.
