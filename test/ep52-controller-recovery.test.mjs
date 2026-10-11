import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFixedTeardownLeaseV1} from '../watchdog/teardown-watchdog/recovery-v1.mjs';
const input={executionId:'run',leaseId:'lease',sourceSha:'a'.repeat(40),planSha256:'b'.repeat(64),accountUuid:'bd0ac817-54dd-47e5-8a66-73d30e19fc3a',nowMs:100000};
test('restart preserves original deadline even after expiry',()=>{
  const original=selectFixedTeardownLeaseV1(input);
  for(const nowMs of [150000,500000]){const recovered=selectFixedTeardownLeaseV1({...input,nowMs,existingLease:original});assert.deepEqual(recovered,original);assert.equal(recovered.expiresAtMs,220000);}
});
test('wrong or corrupted checkpoint rejects instead of minting a new TTL',()=>{
  const lease=selectFixedTeardownLeaseV1(input);
  for(const existingLease of [null,{}, {...lease,sourceSha:'c'.repeat(40)}, {...lease,leaseId:'foreign'}, {...lease,accountUuid:'00000000-0000-0000-0000-000000000000'}, {...lease,issuedAtMs:100001}, {...lease,expiresAtMs:99999}])assert.throws(()=>selectFixedTeardownLeaseV1({...input,existingLease}));
});
