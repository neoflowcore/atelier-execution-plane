import test from "node:test";import assert from "node:assert/strict";
import {compileExecutionPlaneFinalSourceClosureV2,EP52_FINAL_SOURCE_NODES_V2} from "../auth/final-source-closure-v2.mjs";

const id={sourceHead:"a".repeat(40),sourceTree:"b".repeat(40)};
const deferred=[
 {id:"vmware-direct",class:"PROVIDER_LIVE"},
 {id:"vmware-jit",class:"PROVIDER_LIVE"},
 {id:"digitalocean-direct",class:"PROVIDER_LIVE"},
 {id:"digitalocean-jit",class:"PROVIDER_LIVE"},
 {id:"cross-provider-shadow",class:"FINAL_LIVE"},
 {id:"external-cleanup-residue",class:"FINAL_LIVE"},
 {id:"post-seal-integration-live",class:"POST_SEAL_LIVE"}
];

test("latest source closure passes only when every source node including live runner/hot-reattach/post-seal compilers is done",()=>{const r=compileExecutionPlaneFinalSourceClosureV2({...id,completedSourceNodes:EP52_FINAL_SOURCE_NODES_V2,deferredWork:deferred,horizon1IntegrationSealStatus:"PENDING"});assert.equal(r.status,"PASS_SOURCE_EXHAUSTED_LIVE_DEFERRED");assert.equal(r.EXECUTION_PLANE_CREDENTIAL_INDEPENDENT_WORK_EXHAUSTED,true);assert.equal(r.NO_NEXT_CREDENTIAL_INDEPENDENT_WORK,true);assert.equal(r.ACTIVE_NEXT,null);assert.equal(r.HORIZON2_START_ALLOWED,false);assert.equal(r.HORIZON2_BLOCK_REASON,"HORIZON1_EXECUTION_PLANE_INTEGRATION_SEAL_REQUIRED")});
test("missing provider surface driver keeps source progress open",()=>{const completed=EP52_FINAL_SOURCE_NODES_V2.filter(x=>x!=="P20-PROVIDER-SURFACE-DRIVER-RUNNER");const r=compileExecutionPlaneFinalSourceClosureV2({...id,completedSourceNodes:completed,deferredWork:deferred});assert.equal(r.status,"CONTINUE_SOURCE_PROGRESS");assert.equal(r.ACTIVE_NEXT,"P20-PROVIDER-SURFACE-DRIVER-RUNNER");assert.equal(r.EXECUTION_PLANE_CREDENTIAL_INDEPENDENT_WORK_EXHAUSTED,false)});
test("source work cannot be hidden inside deferred-live queue",()=>{const r=compileExecutionPlaneFinalSourceClosureV2({...id,completedSourceNodes:EP52_FINAL_SOURCE_NODES_V2,deferredWork:[...deferred,{id:"forgotten-source",class:"SOURCE"}]});assert.equal(r.status,"CONTINUE_SOURCE_PROGRESS");assert.equal(r.illegalDeferredSourceWork.length,1)});
test("Horizon 2 unlocks only after Horizon 1 additive integration seal",()=>{const r=compileExecutionPlaneFinalSourceClosureV2({...id,completedSourceNodes:EP52_FINAL_SOURCE_NODES_V2,deferredWork:deferred,horizon1IntegrationSealStatus:"SEALED"});assert.equal(r.HORIZON2_START_ALLOWED,true);assert.equal(r.HORIZON2_BLOCK_REASON,null)});
