test('sparse checkout', async () => {
  process.chdir('sparse')
  await indo()

  // Only "mdx/packages/mdx" is checked out.
  expect(fs.list('mdx')).toMatchObject(['.git', 'packages'])
  expect(fs.list('mdx/packages')).toMatchObject(['mdx'])

  // Are node_modules installed?
  expect(fs.isDir('mdx/packages/mdx/node_modules'))
})
