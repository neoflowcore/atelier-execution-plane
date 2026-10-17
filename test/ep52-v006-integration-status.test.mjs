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
  assert.equal(s.liveReferences.R2.status,"PENDING");
  assert.equal(s.liveReferences.R2.humanActuationProvenance,"UNVERIFIED");
  assert.equal(s.safety.ephemeralAccessArtifactResidue,0);
  assert.equal(s.liveReferences.R6.cleanupBoundary,"CLOSED_PROVIDER_KEY_INVENTORY_ZERO");
  assert.equal(s.liveReferences.R6.status,"PENDING");
  assert.equal(s.liveReferences.R6.paidResourceCreateAllowed,false);
  assert.equal(s.safety.newPaidResourceAllowedWhileTransportNotReady,false);
  assert.equal(s.safety.newPaidResourceCreatedByLatestLiveReferences,false);
  assert.equal(s.safety.rawCredentialPersistedByLatestLiveReferences,false);
  assert.equal(s.safety.duplicateExecutionObserved,0);
  assert.equal(s.currentDecision,"R1_R3_R4_R5_LIVE_EVIDENCE_PASS_R2_PROVENANCE_UNVERIFIED_R6_SURFACE_PENDING");
  assert.deepEqual(s.activeNext,[
    "R2_INDEPENDENT_HUMAN_ACTUATION_PROVENANCE",
    "R6_FIRST_PARTY_REMOTE_EXECUTION_SURFACE_REATTACH",
    "R6_PRE_PROVISION_ADMISSION_THEN_AUTHORITATIVE_READBACK_AND_RESIDUE_ZERO"
  ]);
});
