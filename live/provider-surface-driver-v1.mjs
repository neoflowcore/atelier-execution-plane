import { evaluateProviderLiveTransactionV1 } from "./provider-live-transaction-v1.mjs";

const REQUIRED_METHODS=Object.freeze([
  "discover",
  "readCurrent",
  "diffDesired",
  "mutateMinimalDelta",
  "authoritativeReadback",
  "cleanup",
  "deleteReadback",
  "residueScan"
]);

function reqDriver(driver){
  if(!driver||typeof driver!=="object") throw new Error("PROVIDER_SURFACE_DRIVER_REQUIRED");
  for(const m of REQUIRED_METHODS) if(typeof driver[m]!=="function") throw new Error(`PROVIDER_SURFACE_DRIVER_METHOD_REQUIRED:${m}`);
  return driver;
}
function receipt(stage,executionId,status="PASS",extra={}){return Object.freeze({stage,executionId,status,...extra});}
function errCode(error){return error?.code??error?.name??"ERROR";}

export function validateProviderSurfaceDriverV1(driver={}){
  const missing=REQUIRED_METHODS.filter(m=>typeof driver[m]!=="function");
  return Object.freeze({
    ok:missing.length===0,
    missing,
    surfaceClass:driver.surfaceClass??null,
    provider:driver.provider??null,
    rawSecretMaterialExposed:driver.rawSecretMaterialExposed===true,
    browserNormalPath:driver.browserNormalPath===true,
    manualSshNormalPath:driver.manualSshNormalPath===true
  });
}

export async function executeProviderLiveTransactionV1({
  plan,
  driver,
  desiredState,
  transportExecutor,
  context={}
}={}){
  reqDriver(driver);
  if(typeof transportExecutor!=="function") throw new Error("PROVIDER_LIVE_TRANSPORT_EXECUTOR_REQUIRED");
  if(driver.provider!==plan.provider) throw new Error("PROVIDER_SURFACE_DRIVER_PROVIDER_MISMATCH");
  if(driver.rawSecretMaterialExposed===true) throw new Error("RAW_SECRET_SURFACE_DRIVER_DENIED");
  if(driver.browserNormalPath===true) throw new Error("BROWSER_NORMAL_PATH_SURFACE_DRIVER_DENIED");
  if(driver.manualSshNormalPath===true) throw new Error("MANUAL_SSH_SURFACE_DRIVER_DENIED");

  const receipts=[];
  let current=null,diff=null,mutation=null,readback=null,transport=null;
  let primaryError=null;

  try{
    const discovered=await driver.discover({plan,context});
    receipts.push(receipt("DISCOVER",plan.executionId,"PASS",{surfaceClass:driver.surfaceClass??null,discovered}));

    current=await driver.readCurrent({plan,context,discovered});
    receipts.push(receipt("READ_CURRENT",plan.executionId,"PASS",{current}));

    diff=await driver.diffDesired({plan,context,current,desiredState});
    receipts.push(receipt("DIFF_DESIRED",plan.executionId,"PASS",{diff}));

    try{
      mutation=await driver.mutateMinimalDelta({plan,context,current,diff,desiredState});
      receipts.push(receipt("MUTATE_MINIMAL_DELTA",plan.executionId,"PASS",{
        noOp:mutation?.noOp===true,
        resourceCountDelta:Number.isSafeInteger(mutation?.resourceCountDelta)?mutation.resourceCountDelta:0,
        newPaidResourceCreated:mutation?.newPaidResourceCreated===true,
        mutation
      }));
    }catch(error){
      if(errCode(error)!=="OUTCOME_UNKNOWN") throw error;
      if(typeof driver.reconcileUnknown!=="function") throw new Error("PROVIDER_SURFACE_RECONCILE_UNKNOWN_REQUIRED");
      const reconciliation=await driver.reconcileUnknown({plan,context,current,diff,desiredState,error});
      receipts.push(receipt("MUTATE_MINIMAL_DELTA",plan.executionId,"OUTCOME_UNKNOWN",{
        reconciliation,
        resourceCountDelta:Number.isSafeInteger(reconciliation?.resourceCountDelta)?reconciliation.resourceCountDelta:0,
        newPaidResourceCreated:reconciliation?.newPaidResourceCreated===true
      }));
      if(reconciliation?.status!=="RECONCILED") throw new Error("PROVIDER_SURFACE_UNKNOWN_OUTCOME_NOT_RECONCILED");
    }

    readback=await driver.authoritativeReadback({plan,context,current,diff,mutation,desiredState});
    receipts.push(receipt("AUTHORITATIVE_READBACK",plan.executionId,"PASS",{readback}));

    transport=await transportExecutor({plan,context,readback,driver});
    if(transport?.status!=="PASS") throw new Error("PROVIDER_LIVE_TRANSPORT_EXECUTION_NOT_PASS");
    receipts.push(receipt("EXECUTE_TRANSPORT",plan.executionId,"PASS",{transport}));

    receipts.push(receipt("EVIDENCE_RECEIPT",plan.executionId,"PASS",{
      evidenceDigest:transport?.evidenceDigest??null,
      providerReceiptDigest:readback?.receiptDigest??null
    }));
  }catch(error){
    primaryError=error;
  }finally{
    let cleanupError=null;
    try{
      const cleanup=await driver.cleanup({plan,context,current,diff,mutation,readback,transport,primaryError});
      receipts.push(receipt("CLEANUP",plan.executionId,"PASS",{
        ephemeralCredentialResidue:cleanup?.ephemeralCredentialResidue===true,
        cleanup
      }));
    }catch(error){
      cleanupError=error;
      receipts.push(receipt("CLEANUP",plan.executionId,"FAIL",{errorCode:errCode(error)}));
    }

    try{
      const dr=await driver.deleteReadback({plan,context});
      receipts.push(receipt("DELETE_OR_TERMINATE_READBACK",plan.executionId,dr?.resourceAbsent===true?"PASS":"FAIL",{
        resourceAbsent:dr?.resourceAbsent===true,
        deleteReadback:dr
      }));
    }catch(error){
      receipts.push(receipt("DELETE_OR_TERMINATE_READBACK",plan.executionId,"FAIL",{resourceAbsent:false,errorCode:errCode(error)}));
    }

    try{
      const residue=await driver.residueScan({plan,context});
      receipts.push(receipt("RESIDUE_SCAN",plan.executionId,"PASS",{
        ACTIVE_PAID_COMPUTE:residue?.ACTIVE_PAID_COMPUTE,
        ORPHANED_BILLABLE_RESOURCE:residue?.ORPHANED_BILLABLE_RESOURCE,
        BILLABLE_RESIDUE:residue?.BILLABLE_RESIDUE,
        residue
      }));
    }catch(error){
      receipts.push(receipt("RESIDUE_SCAN",plan.executionId,"FAIL",{
        ACTIVE_PAID_COMPUTE:null,
        ORPHANED_BILLABLE_RESOURCE:null,
        BILLABLE_RESIDUE:null,
        errorCode:errCode(error)
      }));
    }

    if(cleanupError&&!primaryError) primaryError=cleanupError;
  }

  // Fill absent execution stages as FAIL so the evaluator remains fail-closed
  const existing=new Set(receipts.map(r=>r.stage));
  for(const stage of ["DISCOVER","READ_CURRENT","DIFF_DESIRED","MUTATE_MINIMAL_DELTA","AUTHORITATIVE_READBACK","EXECUTE_TRANSPORT","EVIDENCE_RECEIPT"]){
    if(!existing.has(stage)) receipts.push(receipt(stage,plan.executionId,"FAIL",{errorCode:errCode(primaryError)}));
  }

  const evaluation=evaluateProviderLiveTransactionV1({plan,receipts});
  return Object.freeze({
    schemaId:"EP52_PROVIDER_SURFACE_EXECUTION_RECEIPT_V1",
    provider:plan.provider,
    transport:plan.transport,
    executionId:plan.executionId,
    receipts:Object.freeze([...receipts]),
    evaluation,
    primaryError:primaryError?{code:errCode(primaryError),message:String(primaryError.message??primaryError)}:null,
    status:evaluation.status
  });
}

export {REQUIRED_METHODS as PROVIDER_SURFACE_DRIVER_REQUIRED_METHODS};
