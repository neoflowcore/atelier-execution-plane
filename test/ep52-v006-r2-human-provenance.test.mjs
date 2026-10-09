import test from "node:test";
import assert from "node:assert/strict";
import {evaluateR2HumanProvenanceV1} from "../v006/human-actuation-provenance-v1.mjs";
const sourceSha="a".repeat(40);
test("GitHub run attempt and user-form triggering actor are not direct-human provenance",()=>{
  const r=evaluateR2HumanProvenanceV1({sourceSha,runAttempt:2,triggeringActor:"neoflowcore"});
  assert.equal(r.status,"PENDING");
  assert.ok(r.blockers.includes("independentVerification"));
  assert.equal(r.githubActorMetadataAloneSufficient,false);
});
test("delegated API rerun cannot be promoted using a forged manual label",()=>{
  const r=evaluateR2HumanProvenanceV1({
    sourceSha,runAttempt:2,triggeringActor:"neoflowcore",
    verifiedHumanReceipt:{sourceSha,origin:"DIRECT_USER_INTERACTION",verifier:"FIRST_PARTY_INTERACTION_LOG",
      operation:"RE_RUN_EXACT_WORKFLOW",actor:"neoflowcore",delegatedApiInvocation:true}
  });
  assert.equal(r.status,"PENDING");
  assert.ok(r.blockers.includes("nonDelegated"));
});
test("a separately verified first-party direct-user receipt meets the contract shape",()=>{
  const r=evaluateR2HumanProvenanceV1({
    sourceSha,runAttempt:2,triggeringActor:"neoflowcore",
    verifiedHumanReceipt:{sourceSha,origin:"DIRECT_USER_INTERACTION",verifier:"FIRST_PARTY_INTERACTION_LOG",
      operation:"RE_RUN_EXACT_WORKFLOW",actor:"neoflowcore",delegatedApiInvocation:false}
  });
  assert.equal(r.status,"PASS");
});
