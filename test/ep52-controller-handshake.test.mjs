import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {evaluateControllerWorkerHandshakeV1} from '../watchdog/teardown-watchdog/handshake-v1.mjs';
function fixture(){
  const sourceSha='a'.repeat(40),planSha256='b'.repeat(64),lease={schemaId:'EP52_TEARDOWN_LEASE_V1',executionId:'run',leaseId:'lease',sourceSha,planSha256,accountUuid:'bd0ac817-54dd-47e5-8a66-73d30e19fc3a',issuedAtMs:100000,expiresAtMs:220000};
  const armed={schemaId:'EP52_TEARDOWN_ARMED_V1',sourceSha,planSha256,leaseDigest:createHash('sha256').update(JSON.stringify(lease)).digest('hex'),expiresAtMs:220000,cleanupAtMs:219000,armedAtMs:100100,paidCreateAuthorized:false,independentFailureDomainAttested:false};
  const isolation={status:'SEPARATE_RUNNER_REFERENCE_PASS',sourceSha,controllerRunId:1,peerRunId:2,checks:Object.fromEntries(['sourceBinding','repositoryBinding','distinctWorkflows','distinctRuns','distinctRunners','jobBinding','controllerRunning','peerCompleted'].map(k=>[k,true]))};
  return {sourceSha,planSha256,nowMs:110000,envelope:{schemaId:'EP52_CONTROLLER_ARM_ENVELOPE_V1',referenceOnly:true,providerMutationsAllowed:false,lease,armed,isolation},controllerState:{sourceSha,runId:1,status:'in_progress',jobStatus:'in_progress',monitorStepRunning:true,runnerId:101,repository:'neoflowcore/atelier-execution-plane'},workerState:{sourceSha,runId:2,status:'in_progress',runnerId:202,repository:'neoflowcore/atelier-execution-plane'}};
}
test('current independently monitored arm crosses runners without conferring paid authority',()=>{
  const r=evaluateControllerWorkerHandshakeV1(fixture());assert.equal(r.status,'LIVE_REFERENCE_HANDSHAKE_PASS');assert.equal(r.paidCreateAuthorized,false);assert.equal(r.finalR6Acceptance,false);
});
test('expired or stale arm, stopped monitor, same runner, altered lease or wrong source/plan block the handshake',()=>{
  const mutations=[x=>{x.nowMs=220000;},x=>{x.nowMs=195000;},x=>{x.controllerState.status='completed';},x=>{x.controllerState.monitorStepRunning=false;},x=>{x.workerState.runnerId=101;},x=>{x.envelope.lease.leaseId='other';},x=>{x.sourceSha='c'.repeat(40);},x=>{x.planSha256='d'.repeat(64);},x=>{x.envelope.armed.paidCreateAuthorized=true;},x=>{x.envelope.providerMutationsAllowed=true;}];
  for(const mutate of mutations){const x=fixture();mutate(x);assert.equal(evaluateControllerWorkerHandshakeV1(x).status,'BLOCKED');}
});
test('missing and malformed input fail closed rather than throw or fabricate acceptance',()=>{
  for(const envelope of [undefined,{}, {lease:{}}]){const r=evaluateControllerWorkerHandshakeV1({envelope});assert.equal(r.status,'BLOCKED');assert.equal(r.finalR6Acceptance,false);}
});
