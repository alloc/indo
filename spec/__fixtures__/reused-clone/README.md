# spec/__fixtures__/reused-clone

- `./` clones the `master` branch of `aleclarson/empty`
- `./1/` clones the same thing as `./`
- `./2/` clones the `foo` branch of `aleclarson/empty`

### Expected

Only two clones should be done: `./empty` and `./2/empty`
