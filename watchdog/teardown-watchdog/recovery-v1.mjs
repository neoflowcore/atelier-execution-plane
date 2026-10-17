import {validateTeardownLeaseV1} from './service-v1.mjs';
export function selectFixedTeardownLeaseV1({existingLease,sourceSha,planSha256,accountUuid,executionId,leaseId,nowMs,ttlMs=120000}={}){
  if(!Number.isSafeInteger(nowMs)||nowMs<0||!Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>1800000)throw Error('TEARDOWN_RECOVERY_CLOCK_REQUIRED');
  const lease=validateTeardownLeaseV1(existingLease===undefined?{schemaId:'EP52_TEARDOWN_LEASE_V1',executionId,leaseId,sourceSha,planSha256,accountUuid,issuedAtMs:nowMs,expiresAtMs:nowMs+ttlMs}:existingLease);
  if(lease.sourceSha!==sourceSha||lease.planSha256!==planSha256||lease.accountUuid!==accountUuid||lease.executionId!==executionId||lease.leaseId!==leaseId||lease.issuedAtMs>nowMs)throw Error('TEARDOWN_RECOVERY_BINDING_MISMATCH');
  return lease;
}
