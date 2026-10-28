import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { legacyConfigSources, planLegacyConfig, previewLegacyConfig, readLegacyConfig } from '../packages/perse-remote-dev/src/legacy-config.ts'

test('legacy config preview reveals field names only and preserves the source bytes', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'pc-legacy-preview-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const original = 'remote-dev:\n  hosts:\n    - id: prod\n      username: secret-user\n      passwordRef: secret-reference\n  workspace: /srv/work\n'
  await writeFile(join(home, 'settings.yaml.imported'), original, { mode: 0o600 })

  assert.deepEqual(await legacyConfigSources(home), ['settings.yaml.imported'])
  const document = await readLegacyConfig(home, 'settings.yaml.imported')
  const preview = previewLegacyConfig(document, [{ ns: 'perse-remote-dev', revision: 3, user: {} }])
  assert.deepEqual(preview.importableFields, ['hosts', 'workspace'])
  assert.deepEqual(preview.conflictFields, [])
  assert.equal(preview.canApply, true)
  assert.equal(JSON.stringify(preview).includes('secret-user'), false)
  assert.equal(JSON.stringify(preview).includes('secret-reference'), false)
  assert.equal(await readFile(join(home, 'settings.yaml.imported'), 'utf8'), original)
})

test('legacy config preview blocks conflicts and unrecognized fields without dropping them', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'pc-legacy-conflict-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  await writeFile(join(home, 'settings.yaml'), 'remote-dev:\n  workspace: /legacy\n  oldCredential: hidden\n')
  const document = await readLegacyConfig(home, 'settings.yaml')
  const preview = previewLegacyConfig(document, [{ ns: 'perse-remote-dev', revision: 1, user: { workspace: '/profile' } }])
  assert.deepEqual(preview.conflictFields, ['workspace'])
  assert.deepEqual(preview.unsupportedFields, ['oldCredential'])
  assert.equal(preview.canApply, false)
  assert.deepEqual(planLegacyConfig(document, [{ ns: 'perse-remote-dev', revision: 1, user: { workspace: '/profile' } }]).patch, {})
  assert.equal(JSON.stringify(preview).includes('/profile'), false)
  assert.equal(JSON.stringify(preview).includes('/legacy'), false)
})

test('legacy config source rejects symlink files and paths outside the native profile home', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'pc-legacy-symlink-'))
  const outside = await mkdtemp(join(tmpdir(), 'pc-legacy-outside-'))
  t.after(async () => { await rm(home, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }) })
  await writeFile(join(outside, 'settings.yaml'), 'remote-dev:\n  workspace: /private\n')
  await symlink(join(outside, 'settings.yaml'), join(home, 'settings.yaml'))
  await assert.rejects(legacyConfigSources(home), /符号链接/)
  await assert.rejects(readLegacyConfig(home, 'settings.yaml'), /普通文件/)
})

test('actual RemoteWorkspaceService readConfiguration preserves targets hub and honors explicit top-level hub', async () => {
  const { RemoteWorkspaceService } = await import('../packages/perse-remote-dev/lib/index.js')
  const configFor = (hub) => ({
    enginePath: { get: () => '' },
    hosts: { get: () => [] },
    targets: { get: () => [{ name: 'Legacy', host: 'legacy-alias', workspace: '/srv/project', hub: '/srv/review-hub', verifyCmd: 'git status' }] },
    workspace: { get: () => '' },
    mDir: { get: () => '' },
    hub: { get: () => hub },
  })
  const serviceFor = (hub) => Object.assign(Object.create(RemoteWorkspaceService.prototype), { config: configFor(hub) })
  const signal = new AbortController().signal

  const legacy = await serviceFor('').readConfiguration({ includeCandidates: false }, signal)
  assert.equal(legacy.resolved.host, 'legacy-alias')
  assert.equal(legacy.resolved.projectPath, '/srv/project')
  assert.equal(legacy.resolved.hub, '/srv/review-hub', 'empty native default must not mask legacy targets[0].hub')
  assert.equal(legacy.resolved.verifyCmd, 'git status')

  const explicit = await serviceFor('/profile/review-hub').readConfiguration({ includeCandidates: false }, signal)
  assert.equal(explicit.resolved.hub, '/profile/review-hub', 'explicit top-level hub has precedence')
})
