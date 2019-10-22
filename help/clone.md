
  indo clone - Shallow clone a git url or npm package

1. If a npm package like "lodash" is given, ask npm for the git url.
   Otherwise, a git url must be given

2. Clone the master branch with a `--depth` of 1

3. If no destination path is given, default to "packages/{name}" where `name` is
   inferred from the "package.json" file

4. Install the clone's "dependencies" and "devDependencies" using the package
   manager inferred from any existing lockfile. When no lockfile exists, default
   to `yarn --no-lockfile`

5. Run the clone's "build" script

6. Update the "repos" object in .indo.json
