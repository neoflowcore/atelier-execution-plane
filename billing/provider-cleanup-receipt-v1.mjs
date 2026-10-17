const REQUIRED=["DELETE_OR_TERMINATE","DELETE_READBACK","EPHEMERAL_CREDENTIAL_DELETE","EPHEMERAL_CREDENTIAL_ABSENCE_READBACK","CHILD_BILLABLE_ARTIFACT_SCAN","PROVIDER_INVENTORY_READBACK","RETENTION_CLASS_RECONCILIATION"];
export function compileProviderCleanupReceiptV1(input={}){
  if(typeof input.provider!=="string"||!input.provider) throw new Error("CLEANUP_PROVIDER_REQUIRED");
  const checks=Object.fromEntries(REQUIRED.map(k=>[k,input[k]===true]));
  const missing=REQUIRED.filter(k=>checks[k]!==true);
  const counts={ACTIVE_PAID_COMPUTE:input.ACTIVE_PAID_COMPUTE,ORPHANED_BILLABLE_RESOURCE:input.ORPHANED_BILLABLE_RESOURCE,BILLABLE_RESIDUE:input.BILLABLE_RESIDUE};
  const zero=Object.values(counts).every(v=>v===0);
  return Object.freeze({schemaId:"EP52_PROVIDER_CLEANUP_RECEIPT_V1",provider:input.provider,resourceId:input.resourceId??null,checks,missing,...counts,residueZero:zero,status:missing.length===0&&zero?"PASS":"FAIL"});
}
export function aggregateCleanupReceiptsV1(receipts=[]){
  if(!Array.isArray(receipts)) throw new Error("CLEANUP_RECEIPTS_REQUIRED");
  const failed=receipts.filter(r=>r?.status!=="PASS");
  const totals=receipts.reduce((a,r)=>({ACTIVE_PAID_COMPUTE:a.ACTIVE_PAID_COMPUTE+(r?.ACTIVE_PAID_COMPUTE??0),ORPHANED_BILLABLE_RESOURCE:a.ORPHANED_BILLABLE_RESOURCE+(r?.ORPHANED_BILLABLE_RESOURCE??0),BILLABLE_RESIDUE:a.BILLABLE_RESIDUE+(r?.BILLABLE_RESIDUE??0)}),{ACTIVE_PAID_COMPUTE:0,ORPHANED_BILLABLE_RESOURCE:0,BILLABLE_RESIDUE:0});
  return Object.freeze({schemaId:"EP52_CLEANUP_AGGREGATE_V1",status:failed.length===0&&Object.values(totals).every(v=>v===0)?"PASS":"PENDING_OR_FAIL",failedProviders:failed.map(r=>r.provider),...totals});
}
