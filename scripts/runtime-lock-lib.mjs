import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const gitBlobSha = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

export async function readJsonBytes(path) {
  const bytes = await readFile(path);
  return { bytes, value: JSON.parse(bytes.toString('utf8')) };
}

export function flattenFreezeBindings(freeze) {
  return freeze.contracts
    .flatMap((contract) => contract.bindings.map((binding) => ({
      contract: contract.name,
      version: contract.version,
      path: binding.path,
      blob: binding.blob
    })))
    .sort((a, b) => a.contract.localeCompare(b.contract) || a.path.localeCompare(b.path));
}
