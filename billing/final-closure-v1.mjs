const REQUIRED=['DELETE_OR_TERMINATE','DELETE_READBACK','EPHEMERAL_CREDENTIAL_DELETE','EPHEMERAL_CREDENTIAL_ABSENCE_READBACK','CHILD_BILLABLE_ARTIFACT_SCAN','PROVIDER_INVENTORY_READBACK','RETENTION_CLASS_RECONCILIATION'];
export function evaluateBillingFinalClosureV1(input={}){
  const missing=REQUIRED.filter(k=>input[k]!==true); const zero=input.ACTIVE_PAID_COMPUTE===0&&input.ORPHANED_BILLABLE_RESOURCE===0&&input.BILLABLE_RESIDUE===0;
  return Object.freeze({schemaId:'EP52_BILLING_FINAL_CLOSURE_V1',status:missing.length===0&&zero?'PASS':'FAIL',missing,activePaidCompute:input.ACTIVE_PAID_COMPUTE,orphanedBillableResource:input.ORPHANED_BILLABLE_RESOURCE,billableResidue:input.BILLABLE_RESIDUE,residueZero:zero});
}
