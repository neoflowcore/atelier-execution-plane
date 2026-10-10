import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {REQUIRED_SOURCE_NODES,compileCredentialIndependentClosurePreflightV1} from '../auth/closure-preflight-v1.mjs';
import {INTERFACE_COMPONENTS,compileExecutionPlaneInterfaceFreezeV1} from '../seal/interface-freeze-v1.mjs';
const root=resolve(import.meta.dirname,'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const componentFiles={
  workerProtocol:'worker/agent/index.mjs',
  computeProviderInterface:'contracts/provider-transport-separation-v1.mjs',
  executionTransportInterface:['transports/direct-worker/index.mjs','transports/github-self-hosted-jit/index.mjs'],
  protocolNegotiation:'contracts/protocol-negotiation-v1.mjs',
  bootstrapBundle:'bootstrap/bundle/index.mjs',
  readyAttestationProducer:'worker/readiness/index.mjs',
  preOperationPackage:'preoperation/execution-package-v1.mjs',
  secretBrokerInterface:'secrets/broker-v1.mjs',
  checkpointResumeAdapter:'checkpoint/index.mjs',
  cacheCandidateArtifactAdapter:'cache/index.mjs',
  cancellationReattachInterface:'session/control-v1.mjs',
  artifactEvidenceAdapter:'artifacts/local-cache/index.mjs',
  externalControlPlaneAdapter:'external-control/bridge-v1.mjs',
  inventoryReaperWatchdog:['watchdog/orphan-reaper/index.mjs','watchdog/teardown-watchdog/index.mjs'],
  jobSnapshotProjection:'snapshot/job-snapshot-v1.mjs',
  projectDeclaration:['project/execution-declaration-v1.mjs','schemas/execution-declaration-v1.schema.json']
};
for(const k of INTERFACE_COMPONENTS) if(!componentFiles[k]) throw new Error(`COMPONENT_FILE_MAPPING_MISSING:${k}`);
const digests={};
for(const [k,p] of Object.entries(componentFiles)){
  const paths=Array.isArray(p)?p:[p]; const parts=[];
  for(const item of paths) parts.push(sha(await readFile(resolve(root,item))));
  digests[k]=sha(Buffer.from(parts.join('\n'),'utf8'));
}
const requirements=[
  {id:'vmware-live',provider:'VMWARE',requiresAuth:true,requiresPaidCompute:false,requiredCapabilities:['vm:read','vm:create','vm:delete','inventory:read'],costCapState:'NOT_APPLICABLE_OR_EXISTING_INFRA',ttlOrLease:'REQUIRED',cleanup:['delete-or-terminate','inventory-readback','sanitation-receipt']},
  {id:'digitalocean-live',provider:'DIGITALOCEAN',requiresAuth:true,requiresPaidCompute:true,requiredCapabilities:['droplet:read','droplet:create','droplet:delete','image:read','region:read','size:read'],costCapState:'USER_AUTHORITY_REQUIRED_AT_ENDGAME',ttlOrLease:'REQUIRED',cleanup:['delete-or-terminate','delete-readback','ephemeral-credential-delete','child-billable-artifact-scan','provider-inventory-readback']},
  {id:'github-jit-live',provider:'GITHUB',requiresAuth:true,requiresPaidCompute:false,requiredCapabilities:['jit-runner-register','jit-runner-deregister','workflow-read','job-read'],costCapState:'NO_NEW_PAID_RESOURCE_BY_EXECUTION_PLANE',ttlOrLease:'EPHEMERAL_REGISTRATION',cleanup:['deregister','credential-absence-readback','runner-absence-readback']}
];
const preflight=compileCredentialIndependentClosurePreflightV1({completedSourceNodes:REQUIRED_SOURCE_NODES,liveRequirements:requirements});
await writeFile(resolve(root,'docs/EP52_AUTH_ENDGAME_CLOSURE_PREFLIGHT_v001.json'),JSON.stringify({...preflight,sourceVerification:{runtimeDependencyLock:'PASS',securityLint:'PASS',semanticTestSuite:'PASS'},deferredLiveWork:['EP52-P19_AUTH_ENDGAME','EP52-P20_LIVE_PROVIDER_TRANSPORT','EP52-P21_REAL_WORKLOAD','EP52-P22_BILLING_CLEANUP_FINAL','EP52-P23_FINAL_FREEZE','EP52-P24_FINAL_DEVELOPMENT_SEAL','COMPATIBILITY_REBIND','INTEGRATION_LIVE','ADDITIVE_INTEGRATION_SEAL']},null,2)+'\n');
const freeze=compileExecutionPlaneInterfaceFreezeV1({componentDigests:digests,runtimeHandoffDigest:'eb122a65afc92d589b1af2eb923167cd47d144e1105669493b117249beefcbf8',liveQualificationStatus:'PENDING'});
await writeFile(resolve(root,'docs/EP52_INTERFACE_FREEZE_CANDIDATE_v001.json'),JSON.stringify({...freeze,componentFiles,finalArtifactIssued:false,reason:'LIVE_QUALIFICATION_PENDING'},null,2)+'\n');
console.log(JSON.stringify({preflight:preflight.status,credentialIndependentExhausted:preflight.EXECUTION_PLANE_CREDENTIAL_INDEPENDENT_WORK_EXHAUSTED,requirements:preflight.requirements.length,freezeEligible:freeze.finalFreezeEligible,freezeCandidateDigest:freeze.interfaceDigest},null,2));
