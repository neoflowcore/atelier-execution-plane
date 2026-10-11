import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const id=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function validateTeardownLeaseV1(lease){
  if(lease?.schemaId!=='EP52_TEARDOWN_LEASE_V1'||!id.test(lease.executionId??'')||!id.test(lease.leaseId??'')||!/^[0-9a-f]{40}$/.test(lease.sourceSha??'')||!/^[0-9a-f]{64}$/.test(lease.planSha256??'')||!/^[0-9a-f-]{36}$/.test(lease.accountUuid??'')||!Number.isSafeInteger(lease.issuedAtMs)||lease.issuedAtMs<0||!Number.isSafeInteger(lease.expiresAtMs)||lease.expiresAtMs<=lease.issuedAtMs||lease.expiresAtMs-lease.issuedAtMs>1800000)throw Error('TEARDOWN_LEASE_BINDING_REQUIRED');
  return Object.freeze({...lease});
}

// Run on a separately supervised controller. A running function is not proof
// that its host survives executor/runner/session loss. It can never provision.
export async function runTeardownServiceV1({lease,provider,onArmed,now=Date.now,sleep=delay,pollMs=1000,maxReconcileAttempts=3}={}){
  lease=validateTeardownLeaseV1(lease);
  if(!provider||!['readAccount','listOwned','readResource','readChildren','deleteResource'].every(k=>typeof provider[k]==='function')||typeof onArmed!=='function'||!Number.isSafeInteger(pollMs)||pollMs<1||pollMs>10000||!Number.isSafeInteger(maxReconcileAttempts)||maxReconcileAttempts<1||maxReconcileAttempts>5)throw Error('TEARDOWN_SERVICE_IO_REQUIRED');
  if(now()<lease.issuedAtMs)throw Error('TEARDOWN_CLOCK_BEFORE_LEASE');
  const account=await provider.readAccount();
  if(account.uuid!==lease.accountUuid||account.status!=='active')throw Error('TEARDOWN_ACCOUNT_MISMATCH');
  const wanted=[`atelier-execution:${lease.executionId}`,`atelier-lease:${lease.leaseId}`];
  const owned=r=>r&&/^[1-9][0-9]*$/.test(String(r.id??''))&&Array.isArray(r.tags)&&wanted.every(t=>r.tags.includes(t))&&Number.isFinite(Date.parse(r.created_at))&&Date.parse(r.created_at)>=lease.issuedAtMs&&Date.parse(r.created_at)<=lease.expiresAtMs;
  const inventory=async()=>{
    const xs=await provider.listOwned(lease);
    if(!Array.isArray(xs))throw Error('TEARDOWN_INVENTORY_UNKNOWN');
    // A tag collision or pre-existing resource must not be silently ignored.
    if(xs.some(x=>!owned(x)))throw Error('TEARDOWN_OWNERSHIP_MISMATCH');
    if(xs.length>1)throw Error('TEARDOWN_OWNERSHIP_AMBIGUOUS');
    return xs;
  };
  await inventory();
  const armed={schemaId:'EP52_TEARDOWN_ARMED_V1',leaseDigest:hash(lease),sourceSha:lease.sourceSha,planSha256:lease.planSha256,expiresAtMs:lease.expiresAtMs,armedAtMs:now(),independentFailureDomainAttested:false,paidCreateAuthorized:false};
  // Admission must not observe armed state before its durable write succeeds.
  await onArmed(Object.freeze(armed));
  while(now()<lease.expiresAtMs)await sleep(Math.min(pollMs,lease.expiresAtMs-now()));
  let xs=await inventory();
  if(xs.length===0)return Object.freeze({...armed,status:'ABSENT_AT_EXPIRY',deleteObserved:false,ownedComputeAbsent:true,childInventoryKnown:false,billableResidueZeroAttested:false,finalR6Acceptance:false});
  const resourceId=String(xs[0].id);
  let childCount=null,deleteObserved=false;
  for(let attempt=0;attempt<maxReconcileAttempts;attempt++){
    const current=await provider.readResource(resourceId);
    if(current===null)break;
    if(!owned(current)||String(current.id)!==resourceId)throw Error('TEARDOWN_RESOURCE_REBIND_DENIED');
    try{
      const children=await provider.readChildren(resourceId);
      const keys=['snapshots','volumes','volume_snapshots','reserved_ips'];
      if(!keys.every(k=>Array.isArray(children?.[k])))throw Error('TEARDOWN_CHILD_SCHEMA');
      childCount=keys.reduce((n,k)=>n+children[k].length,0);
    }catch{childCount=null;}
    const confirmed=await provider.readResource(resourceId);
    if(confirmed===null)break;
    if(!owned(confirmed)||String(confirmed.id)!==resourceId)throw Error('TEARDOWN_RESOURCE_REBIND_DENIED');
    // Unknown child state must not retain owned paid compute. Child resources
    // are preserved and uncertainty remains explicit in the receipt.
    try{await provider.deleteResource(resourceId);deleteObserved=true;}catch{
      // Reconcile the original operation; never assume failure means no write.
    }
    if(await provider.readResource(resourceId)===null)break;
    if(attempt+1<maxReconcileAttempts)await sleep(pollMs);
  }
  const absent=await provider.readResource(resourceId)===null;
  xs=await inventory();
  const zero=absent&&xs.length===0&&childCount===0;
  return Object.freeze({...armed,schemaId:'EP52_TEARDOWN_RESULT_V1',resourceId,status:zero?'OWNED_CLEANUP_OBSERVED':'CLEANUP_UNRESOLVED',deleteObserved,ownedComputeAbsent:absent&&xs.length===0,childInventoryKnown:childCount!==null,childBillableResourceCount:childCount,billableResidueZeroAttested:zero,accountWideResidueZeroAttested:false,finalR6Acceptance:false});
}
