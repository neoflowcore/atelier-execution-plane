const hex40=/^[0-9a-f]{40}$/;
/*
 * The receipt's labels are assertions, not provenance. The caller must use a
 * separately trusted first-party verifier; source-provided fields cannot
 * impersonate a human UI interaction.
 */
export function evaluateR2HumanProvenanceV1(input={},firstPartyVerifier=null){
  const receipt=input.verifiedHumanReceipt??null;
  const independentVerification=typeof firstPartyVerifier==="function"&&receipt!==null&&
    firstPartyVerifier(receipt,{
      sourceSha:input.sourceSha,
      triggeringActor:input.triggeringActor,
      runAttempt:input.runAttempt,
      operation:"RE_RUN_EXACT_WORKFLOW"
    })===true;
  const checks={
    sourceBound:hex40.test(input.sourceSha??"")&&receipt?.sourceSha===input.sourceSha,
    userInitiated:receipt?.origin==="DIRECT_USER_INTERACTION",
    independentVerification,
    specificOperation:receipt?.operation==="RE_RUN_EXACT_WORKFLOW",
    humanActor:typeof input.triggeringActor==="string"&&input.triggeringActor.length>0&&receipt?.actor===input.triggeringActor,
    rerunObserved:Number.isSafeInteger(input.runAttempt)&&input.runAttempt>1,
    nonDelegated:receipt?.delegatedApiInvocation===false
  };
  const blockers=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
  return Object.freeze({
    schemaId:"EP52_V006_R2_HUMAN_PROVENANCE_EVALUATION_V1",
    status:blockers.length?"PENDING":"PASS",
    checks,blockers,
    runAttempt:input.runAttempt??null,
    triggeringActor:input.triggeringActor??null,
    githubActorMetadataAloneSufficient:false,
    selfAssertedVerifierSufficient:false,
    independentVerifierAttached:typeof firstPartyVerifier==="function",
    inferredDirectUserInteraction:false
  });
}
