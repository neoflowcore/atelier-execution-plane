import {createHash} from 'node:crypto';
import {validateTeardownLeaseV1} from './service-v1.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const isolationChecks=['sourceBinding','repositoryBinding','distinctWorkflows','distinctRuns','distinctRunners','jobBinding','controllerRunning','peerCompleted'];

// A reference handshake cannot confer paid provisioning or Runtime acceptance.
export function evaluateControllerWorkerHandshakeV1({envelope,sourceSha,planSha256,controllerState,workerState,nowMs}={}){
  let lease=null;try{lease=validateTeardownLeaseV1(envelope?.lease);}catch{}
  const arm=envelope?.armed,iso=envelope?.isolation;
  const checks={
    envelope:envelope?.schemaId==='EP52_CONTROLLER_ARM_ENVELOPE_V1'&&envelope.referenceOnly===true,
    lease:lease!==null&&lease.accountUuid==='bd0ac817-54dd-47e5-8a66-73d30e19fc3a',
    source:/^[0-9a-f]{40}$/.test(sourceSha??'')&&lease?.sourceSha===sourceSha&&arm?.sourceSha===sourceSha&&iso?.sourceSha===sourceSha&&controllerState?.sourceSha===sourceSha&&workerState?.sourceSha===sourceSha,
    plan:/^[0-9a-f]{64}$/.test(planSha256??'')&&lease?.planSha256===planSha256&&arm?.planSha256===planSha256,
    arm:arm?.schemaId==='EP52_TEARDOWN_ARMED_V1'&&lease!==null&&arm.leaseDigest===digest(lease)&&arm.expiresAtMs===lease.expiresAtMs&&Number.isSafeInteger(arm.cleanupAtMs)&&arm.cleanupAtMs>=lease.issuedAtMs&&arm.cleanupAtMs<lease.expiresAtMs,
    freshness:Number.isSafeInteger(nowMs)&&Number.isSafeInteger(arm?.armedAtMs)&&arm.armedAtMs>=lease?.issuedAtMs&&arm.armedAtMs<=nowMs&&nowMs-arm.armedAtMs<=90000&&arm.cleanupAtMs-nowMs>=30000,
    isolation:iso?.status==='SEPARATE_RUNNER_REFERENCE_PASS'&&isolationChecks.every(k=>iso.checks?.[k]===true),
    currentController:controllerState?.runId===iso?.controllerRunId&&controllerState?.status==='in_progress'&&controllerState?.jobStatus==='in_progress'&&controllerState?.monitorStepRunning===true&&controllerState?.repository==='neoflowcore/atelier-execution-plane',
    currentWorker:workerState?.runId===iso?.peerRunId&&workerState?.status==='in_progress'&&workerState?.repository==='neoflowcore/atelier-execution-plane',
    differentRunners:Number.isSafeInteger(controllerState?.runnerId)&&controllerState.runnerId>0&&Number.isSafeInteger(workerState?.runnerId)&&workerState.runnerId>0&&controllerState.runnerId!==workerState.runnerId,
    referenceAuthority:arm?.paidCreateAuthorized===false&&arm?.independentFailureDomainAttested===false&&envelope?.providerMutationsAllowed===false
  };
  return Object.freeze({schemaId:'EP52_CONTROLLER_WORKER_HANDSHAKE_V1',status:Object.values(checks).every(Boolean)?'LIVE_REFERENCE_HANDSHAKE_PASS':'BLOCKED',checks,blockers:Object.keys(checks).filter(k=>!checks[k]),sourceSha:sourceSha??null,planSha256:planSha256??null,leaseDigest:arm?.leaseDigest??null,controllerRunId:iso?.controllerRunId??null,workerRunId:workerState?.runId??null,observedAtMs:nowMs??null,providerMutations:0,paidCreateAuthorized:false,finalR6Acceptance:false});
}
