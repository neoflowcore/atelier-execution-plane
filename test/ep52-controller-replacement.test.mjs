import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {evaluateControllerReplacementReferenceV1} from '../watchdog/teardown-watchdog/replacement-v1.mjs';
function fixture(){
  const sourceSha='a'.repeat(40),planSha256='b'.repeat(64),runId=7;
  const lease={schemaId:'EP52_TEARDOWN_LEASE_V1',sourceSha,planSha256,accountUuid:'bd0ac817-54dd-47e5-8a66-73d30e19fc3a',executionId:'r6-reference-7',leaseId:'controller-7',issuedAtMs:1000,expiresAtMs:121000};
  const predecessor={schemaId:'EP52_R6_INDEPENDENT_CONTROLLER_REFERENCE_V1',sourceSha,planSha256,paidCreates:0,providerMutations:0,teardown:{status:'ABSENT_AT_EXPIRY',leaseDigest:createHash('sha256').update(JSON.stringify(lease)).digest('hex'),expiresAtMs:121000}};
  return {sourceSha,planSha256,runId,lease,predecessor,nowMs:130000,originalJob:{name:'r6_independent_watchdog',run_id:7,status:'completed',conclusion:'success',runner_id:101},replacementJob:{name:'r6_replacement_controller',run_id:7,status:'in_progress',runner_id:202}};
}
test('expired checkpoint can be reconciled on a different runner without renewing TTL or paid authority',()=>{
  const r=evaluateControllerReplacementReferenceV1(fixture());assert.equal(r.status,'RESTORE_REFERENCE_READY');assert.equal(r.originalExpiresAtMs,121000);assert.equal(r.leaseClockExtended,false);assert.equal(r.paidCreateAuthorized,false);
});
test('same runner, unfinished predecessor, wrong checkpoint/source and unexpired lease reject replacement',()=>{
  const changes=[x=>{x.replacementJob.runner_id=101;},x=>{x.originalJob.status='in_progress';},x=>{x.lease.leaseId='other';},x=>{x.sourceSha='c'.repeat(40);},x=>{x.nowMs=120000;},x=>{x.predecessor.teardown.leaseDigest='d'.repeat(64);}];
  for(const change of changes){const x=fixture();change(x);assert.equal(evaluateControllerReplacementReferenceV1(x).status,'BLOCKED');}
});
