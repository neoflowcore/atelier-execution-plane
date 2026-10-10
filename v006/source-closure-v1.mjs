export const V006_CREDENTIAL_INDEPENDENT_NODES_V1=Object.freeze([
 "V006-P0-PLAN-PREDECESSOR-LOCK",
 "V006-P1-EXECUTOR-TRUST",
 "V006-P2-SNAPSHOT-HANDOFF-PROJECTION",
 "V006-P3-HANDOFF-ENVELOPE-RECEIPT-CHAIN",
 "V006-P4-SAFE-BATCH-REPLAY-FRESHNESS",
 "V006-P5-CONCURRENCY-CANCELLATION-BOUNDARY",
 "V006-P6-PARTIAL-RECONCILIATION-DURABLE-RESUME",
 "V006-P7-AUTHORITATIVE-ACCEPTANCE-FAILURE-CAPSULE",
 "V006-P8-DURABLE-AUTHORITY-SECRET-BROKER-EXTENSION",
 "V006-P9-EPHEMERAL-MINT-CREDENTIAL-ATTESTATION",
 "V006-P10-AUTH-BEFORE-RESOURCE-ADMISSION",
 "V006-P11-EXTERNAL-BRIDGE-ADAPTER-DATA-RETENTION",
 "V006-P12-F01-F38-CONFORMANCE",
 "V006-P14-P18-LIVE-REFERENCE-EVALUATORS",
 "V006-P19-OPERATIONAL-ECONOMY-EVALUATOR",
 "V006-P20-HORIZON-BOUNDARY-COMPILER",
 "V006-P21-FINAL-READINESS-COMPILER",
 "V006-P13-CREDENTIAL-INDEPENDENT-CLOSURE"
]);
export function compileV006SourceClosureV1({completedNodes=[],fixtureStatus,liveAuthoritiesCompiled,minScopesCompiled,existingAuthReuseEvaluated,finalAuthBindManifestCompiled}={}){
 const done=new Set(completedNodes),missing=V006_CREDENTIAL_INDEPENDENT_NODES_V1.filter(x=>!done.has(x));
 const checks={fixtureStatus:fixtureStatus==="PASS",liveAuthoritiesCompiled:liveAuthoritiesCompiled===true,minScopesCompiled:minScopesCompiled===true,existingAuthReuseEvaluated:existingAuthReuseEvaluated===true,finalAuthBindManifestCompiled:finalAuthBindManifestCompiled===true};
 const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
 const pass=missing.length===0&&failures.length===0;
 return Object.freeze({schemaId:"EP52_V006_SOURCE_CLOSURE_V1",requiredNodeCount:V006_CREDENTIAL_INDEPENDENT_NODES_V1.length,completedNodeCount:V006_CREDENTIAL_INDEPENDENT_NODES_V1.length-missing.length,missingNodes:missing,checks,failures,NO_NEXT_CREDENTIAL_INDEPENDENT_V006_WORK:pass,V006_FIELD_LIVE_ELIGIBILITY:pass?"PASS":"PENDING",AUTH_ENDGAME_CLOSURE_PREFLIGHT:pass?"PASS":"PENDING",ACTIVE_NEXT:pass?null:(missing[0]??failures[0]),status:pass?"PASS":"CONTINUE_SOURCE_PROGRESS"});
}
