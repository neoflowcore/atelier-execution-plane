import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readJsonBytes, sha256, gitBlobSha, flattenFreezeBindings } from './runtime-lock-lib.mjs';

const root = resolve(import.meta.dirname, '..');
const { value: lock } = await readJsonBytes(resolve(root, 'contracts/RUNTIME_REV52_DEPENDENCY_LOCK_v001.json'));
assert.equal(lock.dependencyState, 'LOCKED');
assert.equal(lock.runtimeSourceMutationAllowed, false);
assert.equal(lock.runtimeInterfaceRedefinitionAllowed, false);
assert.equal(lock.runtimeSourceHead, '785ae47c1abc4363396b0805a2e43783132465bb');
assert.equal(lock.runtimeSourceTree, '487e701c880ecc49c5a95ba66f12b1cb2c6074fc');
assert.equal(lock.runtimeInterfaceVersion, '5.2-FROZEN');
assert.equal(lock.runtimeInterfaceDigest, 'd6b22817a194b864611118e36d19bb1fda0eeca6b8a60eda31bec82b5bf622c4');
assert.equal(lock.runtimeDevelopmentSealSha256, '9eca75105d511fd910749a7884664fdd89ca181de69f0cde3a449f0f91e10114');
assert.equal(lock.runtimeHandoffDigest, 'eb122a65afc92d589b1af2eb923167cd47d144e1105669493b117249beefcbf8');
for (const artifact of lock.artifactMirror) {
  const { bytes } = await readJsonBytes(resolve(root, artifact.path));
  assert.equal(sha256(bytes), artifact.sha256, `${artifact.path}: sha256 mismatch`);
  assert.equal(gitBlobSha(bytes), artifact.gitBlobSha, `${artifact.path}: git blob mismatch`);
}
const { value: freeze } = await readJsonBytes(resolve(root, 'contracts/runtime52/R52_RUNTIME_INTERFACE_FREEZE_v001.json'));
const { value: seal } = await readJsonBytes(resolve(root, 'contracts/runtime52/R52_RUNTIME_DEVELOPMENT_SEAL_v001.json'));
const { value: handoff } = await readJsonBytes(resolve(root, 'contracts/runtime52/RUNTIME_REV52_HANDOFF_BUNDLE_V1.json'));
assert.equal(freeze.RUNTIME_INTERFACE_VERSION, lock.runtimeInterfaceVersion);
assert.equal(freeze.RUNTIME_INTERFACE_DIGEST, lock.runtimeInterfaceDigest);
assert.equal(seal.runtimeSourceHead, lock.runtimeSourceHead);
assert.equal(seal.runtimeSourceTree, lock.runtimeSourceTree);
assert.equal(seal.RUNTIME_DEVELOPMENT_SEAL_SHA256, lock.runtimeDevelopmentSealSha256);
assert.equal(handoff.runtimeInterfaceDigest, lock.runtimeInterfaceDigest);
assert.equal(handoff.runtimeDevelopmentSealSha256, lock.runtimeDevelopmentSealSha256);
assert.equal(handoff.handoffDigest, lock.runtimeHandoffDigest);
const actualBindings = flattenFreezeBindings(freeze);
const lockedBindings = lock.contractManifest.map((item) => ({ contract: item.name, version: item.version, path: item.path, blob: item.blob })).sort((a, b) => a.contract.localeCompare(b.contract) || a.path.localeCompare(b.path));
assert.deepEqual(actualBindings, lockedBindings, 'contract manifest must exactly mirror frozen Runtime interface bindings');
const receipt = {schema:'EP52_RUNTIME_DEPENDENCY_LOCK_VERIFICATION_V1',status:'PASS',runtimeHead:lock.runtimeSourceHead,runtimeTree:lock.runtimeSourceTree,interfaceDigest:lock.runtimeInterfaceDigest,handoffDigest:lock.runtimeHandoffDigest,mirroredArtifactsVerified:lock.artifactMirror.length,frozenBindingsVerified:actualBindings.length,runtimeMutation:0,runtimeInterfaceRedefinition:0};
console.log(JSON.stringify(receipt, null, 2));
