test(
  'nested indo',
  async () => {
    process.chdir('nested')
    await indo()

    expect(fs.isDir('gist')).toBeTruthy()
    expect(fs.isDir('gist/node_modules')).toBeTruthy()

    expect(fs.isDir('gist/mixpa')).toBeTruthy()
    expect(fs.isDir('gist/mixpa/node_modules')).toBeTruthy()

    expect(logs).toMatchInlineSnapshot(`
      Array [
        "+ Cloned gist from gist.github.com/aleclarson/3877431fe02171c150c401ecb9a5030e",
        "+ Cloned gist/mixpa from github.com/aleclarson/mixpa",
        "✔︎ Installed node_modules of 1 package",
        "✔︎ Installed node_modules of 1 package",
        "+ Linked gist:mixpa to gist/mixpa",
        "✔︎ Local packages are linked!",
      ]
    `)
  },
  30 * 1e3
)
