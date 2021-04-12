test('nested indo', () => {
  process.chdir('nested')
  exec('indo')

  expect(fs.isDir('gist')).toBeTruthy()
  expect(fs.isDir('gist/mixpa')).toBeTruthy()
})
