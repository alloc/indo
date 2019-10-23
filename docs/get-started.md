# Get Started

To start using Indo with a monorepo, run the `indo` command.

This will find every nested `.git` repository. Then it asks which repositories should be automatically cloned for other developers when they run `indo`. Select "Add to vendor" to prevent other developers from using any of the packages inside the `.git` repository. Select "Add to repos" to let Indo clone it for other developers.

Now, commit the `.indo.json` file in your monorepo's root directory. This gives other developers the same configuration used by the `indo` command.

And you're done!
