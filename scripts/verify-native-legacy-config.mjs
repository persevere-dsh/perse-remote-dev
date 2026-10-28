import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const nativeRoot = resolve(process.env.PERSE_DSH_SOURCE_ROOT ?? resolve(repoRoot, '../dsh-remote-native-integration'))
const appBoot = await import(pathToFileURL(join(nativeRoot, 'packages/boot/app-boot/lib/index.js')).href)
const ConfigEditor = (await import(pathToFileURL(join(nativeRoot, 'packages/boot/config-editor/lib/index.js')).href)).default
const SettingsForms = (await import(pathToFileURL(join(nativeRoot, 'packages/settings/settings/lib/index.js')).href)).default
const { RemoteWorkspaceSettingsSchema } = await import(pathToFileURL(join(repoRoot, 'packages/perse-remote-dev/src/settings.ts')).href)
const { legacyConfigSources, planLegacyConfig, previewLegacyConfig, readLegacyConfig } = await import(pathToFileURL(join(repoRoot, 'packages/perse-remote-dev/src/legacy-config.ts')).href)

const temp = mkdtempSync(join(tmpdir(), 'pc-native-legacy-settings-'))
const home = resolve(temp)
const profileDir = join(home, 'profiles', 'isolated')
const profilePatch = join(profileDir, 'cordis.patch.yml')
try {
  appBoot.initProfile(profileDir, ['test-bundle'])
  const bundle = join(profileDir, 'node_modules', 'test-bundle')
  mkdirSync(bundle, { recursive: true })
  writeFileSync(join(home, 'package.json'), '{"name":"isolated-native-settings-fixture"}\n')
  writeFileSync(join(bundle, 'package.json'), JSON.stringify({
    name: 'test-bundle', version: '1.0.0', dsh: { bundle: { patch: 'cordis.patch.yml' } },
  }))
  writeFileSync(join(bundle, 'cordis.patch.yml'), JSON.stringify([{ insert: [
    { id: 'config-editor', name: 'cordis:editor' },
    { id: 'settings', name: 'cordis:settings' },
    { id: 'perse-remote-dev', name: 'cordis:remote-probe', config: {} },
  ] }]))
  writeFileSync(join(profileDir, 'cordis.yml'), '[]\n')
  const profile = {
    name: 'isolated', startedBundles: ['test-bundle'], dir: profileDir, patchPath: profilePatch,
    installAnchor: join(home, 'package.json'), cwd: home, home, overlays: [], telemetryDisabledEnv: undefined,
  }
  const legacySource = 'remote-dev:\n  hosts:\n    - id: legacy\n      name: Legacy host\n      fromAlias: old-host\n      username: test-user\n      passwordRef: fixture-secret-reference\n  targets:\n    - name: Legacy target\n      host: old-host\n      workspace: /srv/project\n      hub: /srv/hub\n      verifyCmd: git status\n  workspace: /srv/project\n'
  writeFileSync(join(home, 'settings.yaml'), legacySource, { mode: 0o600 })
  const probe = { Config: RemoteWorkspaceSettingsSchema, apply() {} }

  const start = async () => await appBoot.boot('test', join(profileDir, 'cordis.yml'), appBoot.readProfilePatches('test', profile), ctx => {
    ctx.provide('profileContext', profile)
    ctx.provide('appReady', { onReady(listener) { listener(); return () => {} } })
    Object.assign(ctx.loader.builtins, { editor: ConfigEditor, settings: SettingsForms, 'remote-probe': probe })
  })
  const waitForImport = async () => {
    const imported = join(home, 'settings.yaml.imported')
    for (let i = 0; i < 100; i += 1) {
      try { readFileSync(imported); return imported } catch { await new Promise(resolve => setTimeout(resolve, 20)) }
    }
    throw new Error('native SettingsForms did not preserve the legacy source as .imported')
  }

  let ctx = await start()
  const importedPath = await waitForImport()
  assert.equal(readFileSync(importedPath, 'utf8'), legacySource, 'native importer keeps exact original bytes')
  assert.deepEqual(await legacyConfigSources(profile.home), ['settings.yaml.imported'])
  const document = await readLegacyConfig(profile.home, 'settings.yaml.imported')
  const descriptor = ctx.settings.describe().find(row => row.ns === 'perse-remote-dev')
  assert.ok(descriptor)
  const preview = previewLegacyConfig(document, ctx.settings.describe())
  assert.equal(preview.canApply, true)
  assert.deepEqual(preview.importableFields, ['hosts', 'targets', 'workspace'])
  assert.equal(JSON.stringify(preview).includes('fixture-secret-reference'), false)
  const plan = planLegacyConfig(document, ctx.settings.describe())
  await ctx.settings.update('perse-remote-dev', plan.patch, plan.revision)
  assert.equal(readFileSync(importedPath, 'utf8'), legacySource, 'explicit import never edits the recovery source')
  const savedPatch = appBoot.readProfilePatches('test', profile)
  assert.ok(savedPatch.some(row => row.id === 'perse-remote-dev' && row.config?.targets?.length === 1))
  assert.ok(!savedPatch.some(row => row.id === 'remote-dev'))
  await ctx.fiber.dispose()

  ctx = await start()
  const restored = ctx.settings.describe().find(row => row.ns === 'perse-remote-dev')
  assert.equal(restored?.value.workspace, '/srv/project')
  assert.deepEqual(restored?.value.targets, document.fields.targets)
  assert.equal(restored?.value.hosts[0]?.fromAlias, 'old-host')
  assert.equal(restored?.value.hosts[0]?.passwordRef, 'fixture-secret-reference')
  assert.equal(restored?.value.hosts[0]?.auth, 'agent', 'native schema defaults are restored with imported fields')
  const repeatPlan = planLegacyConfig(document, ctx.settings.describe())
  assert.deepEqual(repeatPlan.patch, {}, 'reapplying the same old file becomes a no-op')
  assert.deepEqual(repeatPlan.alreadyAppliedFields, ['hosts', 'targets', 'workspace'])
  assert.equal(readFileSync(importedPath, 'utf8'), legacySource)
  await ctx.fiber.dispose()
  console.log('native legacy SettingsForms integration passed: auto-import backup, explicit preview, native update, restart restore, byte-preserved source')
} finally {
  rmSync(temp, { recursive: true, force: true })
}
