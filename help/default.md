
  *indo* <gray>- Prepare your monorepo for action!</gray>

1. Clone any missing repos

2. Find all non-vendor packages

3. Ensure all *.git* repos are tracked in `.indo.json`

4. For any non-vendor package missing its `node_modules`, install any
   `dependencies` and `devDependencies` using its preferred *npm* variant,
   and run its `"build"` script if possible

5. For every non-vendor package, find which dependencies can be satisfied
   by local packages, then replace them with symlinks to local packages
