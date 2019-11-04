import exec from '@cush/exec'

export async function getPublishedVersions(name: string): Promise<string[]> {
  return JSON.parse(await exec(`npm view ${name} versions --json`))
}
