# Configuration

The `.indo.json` config may contain these properties.

- `alias?: object`
- `repos?: object`
- `vendor?: string[]`

The `alias` object works just like Yarn aliases, except only when linking local
packages together. For example, `"foo": "bar"` maps any local dependencies on
`foo` to `bar` **but only if** `bar` is a local package.

The `repos` object tells Indo where to clone from. The `indo` command will search
for unknown clones and offer to add them to `repos` for you. If you decline, they
will be added to `vendor` instead.

The `vendor` array tells Indo which globs to treat like external dependencies.
Any matching package never has its dependencies managed by Indo. No linking, no
installing. This defaults to `["vendor/**"]`.
