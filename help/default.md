
  indo - Prepare your monorepo for action!

1. Clone any missing repos

2. Find all non-vendor packages

3. Ensure all .git repos are tracked in the ".indo.json" config file

4. Install dependencies and run the "build" script of any packages missing
   their node_modules

5. For every non-vendor package, find which dependencies can be replaced by
   local packages
