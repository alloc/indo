# Using A Temporary Fork

Sometimes you need to fork a dependency for a temporary fix, and you want every developer to use that fork instead of the max satisfying npm version.

To solve this with `indo`, you do the following:

1. Clone the npm package:

```sh
# Create "vendor/lodash" from the git url in package.json
indo clone lodash

# Or use a git url explicitly
indo clone https://github.com/lodash/lodash.git ./vendor/lodash
```

2. Apply your changes to `vendor/lodash`

3. Commit the `.indo.json` file

4. Done!

Then, other developers can clone your monorepo and run `indo`, which clones `vendor/lodash` for them automatically. For more info, please see ["Bootstrap Your Packages"](./bootstrap.md).
