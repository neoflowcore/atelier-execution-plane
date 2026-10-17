import { COMPATIBILITY_REBIND_CHECKS } from "../compat/rebind-v1.mjs";
import { REQUIRED_INTEGRATION_LIVE_CHECKS } from "./live-qualification-v1.mjs";

const SHA=/^[0-9a-f]{64}$/;
function valid(v){return SHA.test(v??"");}

export function compilePostSealCompatibilityPlanV1(input={}){
  const upstreamReady=valid(input.runtimeDevelopmentSealDigest)&&valid(input.piloteDevelopmentSealDigest)&&valid(input.historicalFinalSealDigest);
  const epReady=valid(input.executionPlaneDevelopmentSealDigest)&&valid(input.executionPlaneHandoffDigest);
  return Object.freeze({
    schemaId:"EP52_POST_SEAL_COMPATIBILITY_PLAN_V1",
    upstreamReady,
    executionPlaneReady:epReady,
    runtimeSourceMutationPlanned:0,
    piloteSourceMutationPlanned:0,
    checks:[...COMPATIBILITY_REBIND_CHECKS],
    state:upstreamReady&&epReady?"READY_FOR_COMPATIBILITY_REBIND":"WAITING_EXECUTION_PLANE_SEAL_HANDOFF",
    maintenanceEscapeHatchAllowedOnlyOnProvenFrozenContractGap:true
  });
}

export function compilePostSealIntegrationLivePlanV1(input={}){
  const compatibilityReady=input.compatibilityRebindStatus==="PASS";
  return Object.freeze({
    schemaId:"EP52_POST_SEAL_INTEGRATION_LIVE_PLAN_V1",
    compatibilityReady,
    checks:[...REQUIRED_INTEGRATION_LIVE_CHECKS],
    reuseExistingAuthEnvelope:true,
    repeatHistoricalRev52LiveSuite:false,
    requiredFlow:"PILOTE_RUNTIME_EXECUTION_PLANE_WORKER_EVIDENCE_RUNTIME_ACCEPTANCE_PILOTE",
    state:compatibilityReady?"READY_FOR_BOUNDED_INTEGRATION_LIVE":"WAITING_COMPATIBILITY_REBIND_PASS"
  });
}
