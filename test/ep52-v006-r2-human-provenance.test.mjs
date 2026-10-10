import test from "node:test";
import assert from "node:assert/strict";
import {evaluateR2HumanProvenanceV1} from "../v006/human-actuation-provenance-v1.mjs";
const sourceSha="a".repeat(40);
const base={sourceSha,runAttempt:2,triggeringActor:"neoflowcore"};
const receipt={sourceSha,origin:"DIRECT_USER_INTERACTION",verifier:"FIRST_PARTY_INTERACTION_LOG",
  operation:"RE_RUN_EXACT_WORKFLOW",actor:"neoflowcore",delegatedApiInvocation:false};

test("API rerun metadata cannot establish independent human provenance",()=>{
  const r=evaluateR2HumanProvenanceV1(base);
  assert.equal(r.status,"PENDING");
  assert.ok(r.blockers.includes("independentVerification"));
  assert.equal(r.githubActorMetadataAloneSufficient,false);
});
test("self-labelled first-party audit proof is rejected without trusted verifier",()=>{
  const r=evaluateR2HumanProvenanceV1({...base,verifiedHumanReceipt:receipt});
  assert.equal(r.status,"PENDING");
  assert.ok(r.blockers.includes("independentVerification"));
  assert.equal(r.selfAssertedVerifierSufficient,false);
});
test("a delegated API rerun remains pending even with a trusted verifier fixture",()=>{
  const r=evaluateR2HumanProvenanceV1(
    {...base,verifiedHumanReceipt:{...receipt,delegatedApiInvocation:true}},()=>true
  );
  assert.equal(r.status,"PENDING");
  assert.ok(r.blockers.includes("nonDelegated"));
});
test("trusted runtime verification contract admits positive supplemental fixture",()=>{
  const trustedFixture=(proof,context)=>proof===receipt&&context.sourceSha===sourceSha;
  const r=evaluateR2HumanProvenanceV1({...base,verifiedHumanReceipt:receipt},trustedFixture);
  assert.equal(r.status,"PASS");
  assert.equal(r.independentVerifierAttached,true);
  assert.equal(r.inferredDirectUserInteraction,false);
});
test("even a positive verifier cannot override source/actor/operation mismatch",()=>{
  const tampered=[
    {...receipt,sourceSha:"b".repeat(40)},
    {...receipt,actor:"different"},
    {...receipt,operation:"WRONG_OPERATION"}
  ];
  for(const proof of tampered){
    assert.equal(evaluateR2HumanProvenanceV1({...base,verifiedHumanReceipt:proof},()=>true).status,"PENDING");
  }
});
