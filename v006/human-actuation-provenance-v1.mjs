const hex40=/^[0-9a-f]{40}$/;
export function evaluateR2HumanProvenanceV1(input={}){
  const receipt=input.verifiedHumanReceipt??null;
  const checks={
    sourceBound:hex40.test(input.sourceSha??"")&&receipt?.sourceSha===input.sourceSha,
    userInitiated:receipt?.origin==="DIRECT_USER_INTERACTION",
    independentVerification:receipt?.verifier==="FIRST_PARTY_INTERACTION_LOG",
    specificOperation:receipt?.operation==="RE_RUN_EXACT_WORKFLOW",
    humanActor:typeof input.triggeringActor==="string"&&input.triggeringActor.length>0&&receipt?.actor===input.triggeringActor,
    rerunObserved:Number.isSafeInteger(input.runAttempt)&&input.runAttempt>1,
    nonDelegated:receipt?.delegatedApiInvocation===false
  };
  const blockers=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
  return Object.freeze({
    schemaId:"EP52_V006_R2_HUMAN_PROVENANCE_EVALUATION_V1",
    status:blockers.length?"PENDING":"PASS",
    blockers,
    runAttempt:input.runAttempt??null,
    triggeringActor:input.triggeringActor??null,
    githubActorMetadataAloneSufficient:false,
    inferredDirectUserInteraction:false
  });
}
