import test from "node:test";import assert from "node:assert/strict";
import {compileProviderLiveTransactionV1} from "../live/provider-live-transaction-v1.mjs";
import {executeProviderLiveTransactionV1,validateProviderSurfaceDriverV1} from "../live/provider-surface-driver-v1.mjs";

const base={sourceHead:"a".repeat(40),sourceTree:"b".repeat(40),attachTicketDigest:"c".repeat(64)};
function fakeDriver({provider="VMWARE",unknown=false,transportFail=false,residue=0}={}){
  let present=false;
  return {
    provider,surfaceClass:"TRUSTED_EXECUTOR",rawSecretMaterialExposed:false,browserNormalPath:false,manualSshNormalPath:false,
    async discover(){return {status:"PASS"}},
    async readCurrent(){return {present}},
    async diffDesired(){return {action:present?"NOOP":"CREATE"}},
    async mutateMinimalDelta(){
      if(unknown){present=true;const e=new Error("unknown");e.code="OUTCOME_UNKNOWN";throw e;}
      present=true;return {noOp:false,resourceCountDelta:1,newPaidResourceCreated:false};
    },
    async reconcileUnknown(){return {status:"RECONCILED",resourceCountDelta:1,newPaidResourceCreated:false}},
    async authoritativeReadback(){return {present:true,receiptDigest:"d".repeat(64)}},
    async cleanup(){present=false;return {ephemeralCredentialResidue:false}},
    async deleteReadback(){return {resourceAbsent:!present}},
    async residueScan(){return {ACTIVE_PAID_COMPUTE:0,ORPHANED_BILLABLE_RESOURCE:0,BILLABLE_RESIDUE:residue}},
    transportFail
  };
}
test("surface driver contract requires all lifecycle methods",()=>{const v=validateProviderSurfaceDriverV1(fakeDriver());assert.equal(v.ok,true);assert.equal(v.manualSshNormalPath,false)});
test("runner executes provider transaction and always closes cleanup/readback/residue",async()=>{const p=compileProviderLiveTransactionV1({...base,provider:"VMWARE",transport:"DIRECT_WORKER",executionId:"vm1"});const r=await executeProviderLiveTransactionV1({plan:p,driver:fakeDriver(),desiredState:{},transportExecutor:async()=>({status:"PASS",evidenceDigest:"e".repeat(64)})});assert.equal(r.status,"PASS");assert.equal(r.evaluation.cleanupResidueZero,true);assert.ok(r.receipts.find(x=>x.stage==="DELETE_OR_TERMINATE_READBACK"&&x.resourceAbsent===true))});
test("OUTCOME_UNKNOWN is reconciled and still cleaned",async()=>{const p=compileProviderLiveTransactionV1({...base,provider:"VMWARE",transport:"DIRECT_WORKER",executionId:"vm2"});const r=await executeProviderLiveTransactionV1({plan:p,driver:fakeDriver({unknown:true}),desiredState:{},transportExecutor:async()=>({status:"PASS",evidenceDigest:"e".repeat(64)})});assert.equal(r.status,"PASS");const m=r.receipts.find(x=>x.stage==="MUTATE_MINIMAL_DELTA");assert.equal(m.status,"OUTCOME_UNKNOWN");assert.equal(m.reconciliation.status,"RECONCILED")});
test("transport failure still performs cleanup but transaction fails",async()=>{const p=compileProviderLiveTransactionV1({...base,provider:"VMWARE",transport:"GITHUB_SELF_HOSTED_JIT",executionId:"vm3"});const r=await executeProviderLiveTransactionV1({plan:p,driver:fakeDriver(),desiredState:{},transportExecutor:async()=>({status:"FAIL"})});assert.equal(r.status,"FAIL");assert.ok(r.receipts.find(x=>x.stage==="CLEANUP"&&x.status==="PASS"));assert.ok(r.receipts.find(x=>x.stage==="DELETE_OR_TERMINATE_READBACK"&&x.resourceAbsent===true))});
test("residue makes success impossible even after nominal execution",async()=>{const p=compileProviderLiveTransactionV1({...base,provider:"VMWARE",transport:"DIRECT_WORKER",executionId:"vm4"});const r=await executeProviderLiveTransactionV1({plan:p,driver:fakeDriver({residue:1}),desiredState:{},transportExecutor:async()=>({status:"PASS"})});assert.equal(r.status,"FAIL");assert.ok(r.evaluation.errors.includes("BILLABLE_RESIDUE_NOT_ZERO"))});
test("raw-secret, browser-normal-path or manual-ssh drivers are denied before mutation",async()=>{for(const key of ["rawSecretMaterialExposed","browserNormalPath","manualSshNormalPath"]){const d=fakeDriver();d[key]=true;const p=compileProviderLiveTransactionV1({...base,provider:"VMWARE",transport:"DIRECT_WORKER",executionId:`deny-${key}`});await assert.rejects(()=>executeProviderLiveTransactionV1({plan:p,driver:d,desiredState:{},transportExecutor:async()=>({status:"PASS"})}),/DENIED/)}});
