
  <bold>indo rm</bold><gray> - Remove a directory and update the `.indo.json` file</gray>

The removed directory is not required to contain a `package.json` file at its root. It can also be a directory that contains multiple packages. Either way, the `.indo.json` file is updated accordingly. Also, dependencies are re-installed for non-vendor packages that were linked to a removed package.
