#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { compilePostSealCompatibilityPlanV1, compilePostSealIntegrationLivePlanV1 } from "../integration/post-seal-plan-v1.mjs";

const exec=promisify(execFile);
const head=(await exec("git",["rev-parse","HEAD"],{encoding:"utf8"})).stdout.trim();
const tree=(await exec("git",["rev-parse","HEAD^{tree}"],{encoding:"utf8"})).stdout.trim();
const compatibility=compilePostSealCompatibilityPlanV1({
  runtimeDevelopmentSealDigest:"9eca75105d511fd910749a7884664fdd89ca181de69f0cde3a449f0f91e10114",
  piloteDevelopmentSealDigest:"a1b455c66bbeaa58948eeba38606dc48446d77ff468acb50037337cf8199766d",
  historicalFinalSealDigest:"4f767f0125301cdb678b36a95e92658616e8a5732a12e41ba40b02aa827b3b00"
});
const integration=compilePostSealIntegrationLivePlanV1({compatibilityRebindStatus:"PENDING"});
const body={
  schemaId:"EP52_POST_SEAL_RESUME_PLAN_V1",
  sourceHead:head,
  sourceTree:tree,
  executionPlaneDevelopmentSealDigest:null,
  executionPlaneHandoffDigest:null,
  compatibility,
  integration,
  runtimeSourceMutationPlanned:0,
  piloteSourceMutationPlanned:0,
  maintenanceEscapeHatchState:"CLOSED_UNLESS_PROVEN_FROZEN_CONTRACT_GAP",
  nextAfterExecutionPlaneSeal:"COMPATIBILITY_REBIND_WITH_SOURCE_MUTATION_ZERO_PREFERRED",
  finalAfterCompatibility:"BOUNDED_INTEGRATION_LIVE_THEN_ADDITIVE_INTEGRATION_SEAL"
};
await mkdir("artifacts/ep52/post-seal",{recursive:true});
await writeFile("artifacts/ep52/post-seal/resume-plan.json",JSON.stringify(body,null,2)+"\n");
console.log(`EP52_POST_SEAL_RESUME_PLAN=PASS head=${head}`);
