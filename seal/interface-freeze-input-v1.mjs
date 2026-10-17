import { createHash } from "node:crypto";
const sha=v=>createHash("sha256").update(JSON.stringify(v),"utf8").digest("hex");
export const EP52_FREEZE_COMPONENT_PATHS=Object.freeze({
  workerProtocol:"worker/agent/index.mjs",
  computeProviderInterface:"contracts/provider-transport-separation-v1.mjs",
  executionTransportInterface:"contracts/provider-transport-separation-v1.mjs",
  protocolNegotiation:"contracts/protocol-negotiation-v1.mjs",
  bootstrapBundle:"bootstrap/bundle/index.mjs",
  readyAttestationProducer:"worker/readiness/index.mjs",
  preOperationPackage:"preoperation/execution-package-v1.mjs",
  secretBrokerInterface:"secrets/broker-v1.mjs",
  checkpointResumeAdapter:"checkpoint/index.mjs",
  cacheCandidateArtifactAdapter:"cache/index.mjs",
  cancellationReattachInterface:"session/control-v1.mjs",
  artifactEvidenceAdapter:"artifacts/local-cache/index.mjs",
  externalControlPlaneAdapter:"external-control/bridge-v1.mjs",
  inventoryReaperWatchdog:"watchdog/orphan-reaper/index.mjs",
  jobSnapshotProjection:"snapshot/job-snapshot-v1.mjs",
  projectDeclaration:"project/execution-declaration-v1.mjs"
});
export function compileInterfaceFreezeInputManifestV1(blobMap={}){
  const components={};
  for(const [name,path] of Object.entries(EP52_FREEZE_COMPONENT_PATHS)){
    const blob=blobMap[path];
    if(typeof blob!=="string"||!/^[0-9a-f]{40}$/.test(blob)) throw new Error(`FREEZE_BLOB_MISSING:${path}`);
    components[name]=sha({path,blob});
  }
  return Object.freeze({schemaId:"EP52_INTERFACE_FREEZE_INPUT_MANIFEST_V1",components,sourcePaths:{...EP52_FREEZE_COMPONENT_PATHS},liveQualificationRequiredBeforeFinalFreeze:true});
}
