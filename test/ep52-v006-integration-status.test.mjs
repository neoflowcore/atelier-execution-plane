import test from "node:test";import assert from "node:assert/strict";import {readFile} from "node:fs/promises";

test("v006 binding reflects source-closed live-pending reality",async()=>{
  const b=JSON.parse(await readFile(new URL("../docs/EP52_V006_PLAN_BINDING_v001.json",import.meta.url),"utf8"));
  assert.equal(b.status,"BOUND_ADDITIVE_SOURCE_CLOSED_LIVE_PENDING");
  assert.equal(b.currentHorizon1CredentialIndependentWorkExhausted,true);
  assert.equal(b.v006NegativeFixtureStatus,"PASS");
  assert.equal(b.vmwareRequiredForCurrentSourceProgress,false);
  assert.equal(b.horizon2StartAllowed,false);
});

test("v006 integration status preserves predecessor boundaries while advancing agent-assisted live references",async()=>{
  const s=JSON.parse(await readFile(new URL("../docs/EP52_V006_INTEGRATION_STATUS_v001.json",import.meta.url),"utf8"));
  assert.equal(s.sourceIntegration.P0_P13,"PASS");
  assert.equal(s.sourceIntegration.F01_F38,"PASS");
  assert.equal(s.safety.predecessorDigitalOceanEvidencePromotionToV006,false);
  assert.equal(s.liveReferences.R1.status,"PASS");
  assert.equal(s.liveReferences.R3.status,"PASS");
  assert.equal(s.liveReferences.R4.status,"PASS");
  assert.equal(s.liveReferences.R5.status,"PASS");
  assert.equal(s.liveReferences.R2.status,"PASS");
  assert.equal(s.liveReferences.R6.status,"PENDING");
  assert.equal(s.liveReferences.R6.paidResourceCreateAllowed,false);
  assert.equal(s.safety.newPaidResourceAllowedWhileTransportNotReady,false);
  assert.equal(s.safety.newPaidResourceCreatedByLatestLiveReferences,false);
  assert.equal(s.safety.rawCredentialPersistedByLatestLiveReferences,false);
  assert.equal(s.safety.duplicateExecutionObserved,0);
  assert.equal(s.currentDecision,"AGENT_ASSISTED_LIVE_REFERENCES_R1_R2_R3_R4_R5_PASS_R6_PENDING_CLEANUP_BOUNDARY");
  assert.deepEqual(s.activeNext,[
    "R2_HUMAN_ACTUATED_EXTERNAL_EXECUTOR",
    "R6_PAID_RESOURCE_AUTH_PREFLIGHT_AFTER_EXECUTION_TRANSPORT_READY"
  ]);
});
