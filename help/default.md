
  <bold>indo</bold><gray> - Prepare your monorepo for action!</gray>

1. Clone any missing repos

2. Find all non-vendor packages

3. Ensure all *.git* repos are tracked in `.indo.json`

4. For any non-vendor package missing its `node_modules`, install any
   `dependencies` and `devDependencies` using its preferred *npm* variant,
   and run its `"build"` script if possible

5. For every non-vendor package, find which dependencies can be satisfied
   by local packages, then replace them with symlinks to local packages


*Sub commands*
⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺

- *add* <gray>[...packages]</gray>
  Install one or more packages, respecting the preferred *npm* variant. 
  Afterwards, replace the package with a local equivalent, if possible.
  Run `indo add -h` to learn more.

- *clone* <gray>\<package></gray>
  Shallow clone a git repository or npm package.
  Run `indo clone -h` to learn more.

- *exec* <gray>-- \<command> [...args]</gray>
  Execute a shell command in every non-vendor package.

- *git* <gray>\<command> [...args]</gray>
  Run a `git` command in every non-vendor package with a `.git` folder.

- *init*
  Create a `.indo.json` file in the current directory.

- *link* <gray>[package]</gray>
  Link a package from the global indo registry into the `vendor` folder.
  If no argument is given, link the current package into the global registry.

- *list*
  List all packages found by indo in the current monorepo.
  Pass `-g` to list packages in the global indo registry.

- *move* <gray>\<old_name> \<new_name></gray>
  Rename a package, updating `.indo.json` if needed, and run `indo` after.

- *purge* <gray>[...paths]</gray>
  Destroy the given directory paths, updating `.indo.json` if needed.
  Afterwards, dependent packages have their `node_modules` repaired.
  Run `indo purge -h` to learn more.

- *remove* <gray>[...packages]</gray>
  Uninstall one or more packages, respecting the preferred *npm* variant. 

- *run* <gray>\<script></gray>
  Run a npm script in every non-vendor package.

- *share*
  Select linked packages that should be cloned on other machines.
  Run `indo share -h` to learn more.

- *unlink* <gray>[package]</gray>
  Remove a linked package from the `vendor` folder.
  If no argument is given, unlink the current package from the global registry.

- *upgrade* <gray>[...packages]</gray>
  Interactively upgrade the given dependencies.
