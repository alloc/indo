test('nested indo', async () => {
  process.chdir('nested')
  await indo()

  expect(fs.isDir('gist')).toBeTruthy()
  expect(fs.isDir('gist/mixpa')).toBeTruthy()
})
