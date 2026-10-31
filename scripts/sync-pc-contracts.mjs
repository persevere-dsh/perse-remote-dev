import { createHash } from 'node:crypto'
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageRoot = join(root, 'packages/perse-remote-dev')
const mirrorRoot = join(packageRoot, 'docs')
const explicitCanonicalRoot = process.env.PERSE_REMOTE_CANONICAL_ROOT
const canonicalRoot = explicitCanonicalRoot ?? resolve(root, '../perse-ios-app')
const protocolSources = [
  {
    id: '001-remote-development',
    source: join(canonicalRoot, 'specs/001-remote-development/contracts/protocol.md'),
    rootMirror: 'docs/protocol/v1.md',
    packageMirror: 'protocol/v1.md',
    sha256: '738dd7db6f9fad596e1b4eee90a221c09a9107fa7e75afa6f58de09e8310488b',
  },
  {
    id: '002-mobile-workflows',
    source: join(canonicalRoot, 'specs/002-mobile-workflows/contracts/protocol.md'),
    rootMirror: 'docs/protocol/v1.1.md',
    packageMirror: 'protocol/v1.1.md',
    sha256: 'f53676df3078a9038e8ac18e9904ee7be08783c147c13d7f804bae083a17d0f4',
  },
  {
    id: '003-task-centered-experience',
    source: join(canonicalRoot, 'specs/003-task-centered-experience/contracts/protocol.md'),
    rootMirror: 'docs/protocol/v1.2.md',
    packageMirror: 'protocol/v1.2.md',
    sha256: '7efce2961a553e8089ddd618d03ca63940ad51b39be60f4f0d90e94bc9715047',
  },
  {
    id: '005-remote-model-selection',
    source: join(canonicalRoot, 'specs/005-remote-model-selection/contracts/protocol.md'),
    rootMirror: 'docs/protocol/v1.3.md',
    packageMirror: 'protocol/v1.3.md',
    sha256: '45417131c369aca4435500865ed60633cd3deb08f248747bd9178a770f3dd6a3',
  },
]

const localHashes = []
let canonicalAvailable = true
try {
  await access(join(canonicalRoot, 'specs/001-remote-development/contracts/protocol.md'))
  await access(join(canonicalRoot, 'specs/002-mobile-workflows/contracts/protocol.md'))
  await access(join(canonicalRoot, 'specs/003-task-centered-experience/contracts/protocol.md'))
  await access(join(canonicalRoot, 'specs/005-remote-model-selection/contracts/protocol.md'))
} catch (error) {
  if (explicitCanonicalRoot !== undefined) throw new Error(`explicit PERSE_REMOTE_CANONICAL_ROOT is unavailable: ${canonicalRoot}`, { cause: error })
  canonicalAvailable = false
}

for (const item of protocolSources) {
  const rootCopy = await readFile(join(root, item.rootMirror))
  const rootHash = hash(rootCopy)
  if (rootHash !== item.sha256) {
    throw new Error(`${item.id} contract mirror is stale; update the local copy and reviewed hash after changing the canonical contract`)
  }
  if (canonicalAvailable) {
    const canonical = await readFile(item.source)
    if (hash(canonical) !== item.sha256 || !canonical.equals(rootCopy)) {
      throw new Error(`${item.id} package mirror does not match its canonical Perse contract`)
    }
  }
  localHashes.push({ id: item.id, source: item.source.replace(`${canonicalRoot}/`, ''), mirror: item.packageMirror, sha256: rootHash })
}

await mkdir(join(mirrorRoot, 'protocol'), { recursive: true })
for (const source of ['docs/pc-spec.md', 'docs/pc-plan.md', 'docs/pc-contract.md']) {
  await copyFile(join(root, source), join(mirrorRoot, source.split('/').at(-1)))
}
// Publish the repository's exact MIT license bytes with the installable package.
await copyFile(join(root, 'LICENSE'), join(packageRoot, 'LICENSE'))
for (const item of protocolSources) {
  await copyFile(join(root, item.rootMirror), join(mirrorRoot, item.packageMirror))
}
const manifest = {
  contract: '004-pc-remote-development',
  generatedFrom: 'root docs/pc-* and docs/protocol/*; protocol digests are frozen and optionally checked against specs/001,002,003,005/contracts/protocol.md',
  canonicalPerseSpecsVerified: canonicalAvailable,
  mirrors: localHashes,
}
await writeFile(join(mirrorRoot, 'protocol-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`synced PC contracts and verified ${localHashes.length} canonical protocol hashes`)

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}
