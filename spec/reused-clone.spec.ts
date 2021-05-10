import { resolve } from 'path'

test(
  'reused clone',
  async () => {
    process.chdir('reused-clone')
    await indo()

    expect(fs.isDir('empty')).toBeTruthy()
    expect(fs.isDir('1/empty')).toBeFalsy()
    expect(fs.follow('1/empty')).toBe(resolve('empty'))
    expect(fs.isDir('2/empty')).toBeTruthy()

    expect(logs).toMatchInlineSnapshot(`
      Array [
        "+ Cloned ./2/empty from github.com/aleclarson/empty",
        "+ Cloned ./empty from github.com/aleclarson/empty",
        "",
        "✔︎ Local packages are linked!",
      ]
    `)
  },
  30 * 1e3
)
