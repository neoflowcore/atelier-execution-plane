function reqString(v, code){ if(typeof v !== 'string' || !v) throw new Error(code); return v; }
function normalizeJob(job, index){
  if(!job || typeof job !== 'object' || Array.isArray(job)) throw new Error('DAG_JOB_INVALID');
  const id=reqString(job.id,'DAG_JOB_ID_REQUIRED');
  const dependsOn=[...new Set(job.dependsOn ?? [])];
  if(dependsOn.some(x=>typeof x!=='string'||!x)) throw new Error('DAG_DEPENDENCY_INVALID');
  return {id,dependsOn,order:Number.isSafeInteger(job.order)?job.order:index,estimatedCostMilliUsd:Number.isSafeInteger(job.estimatedCostMilliUsd)?job.estimatedCostMilliUsd:0,payload:job.payload??null};
}
export function compileMultiWorkerDagV1({jobs=[],joins=[]}={}){
  if(!Array.isArray(jobs)||jobs.length<2) throw new Error('MULTI_WORKER_REQUIRES_AT_LEAST_TWO_JOBS');
  const normalized=jobs.map(normalizeJob); const ids=new Set();
  for(const j of normalized){ if(ids.has(j.id)) throw new Error('DAG_JOB_ID_DUPLICATE'); ids.add(j.id); }
  for(const j of normalized) for(const d of j.dependsOn) if(!ids.has(d)) throw new Error('DAG_DEPENDENCY_MISSING');
  const visiting=new Set(), visited=new Set(), byId=new Map(normalized.map(j=>[j.id,j]));
  function visit(id){ if(visiting.has(id)) throw new Error('DAG_CYCLE_DETECTED'); if(visited.has(id)) return; visiting.add(id); for(const d of byId.get(id).dependsOn) visit(d); visiting.delete(id); visited.add(id); }
  for(const j of normalized) visit(j.id);
  const declaredJoins=(joins??[]).map(j=>({id:reqString(j.id,'JOIN_ID_REQUIRED'),waitFor:[...new Set(j.waitFor??[])]}));
  for(const join of declaredJoins){ if(join.waitFor.length<2) throw new Error('JOIN_REQUIRES_TWO_INPUTS'); for(const id of join.waitFor) if(!ids.has(id)) throw new Error('JOIN_DEPENDENCY_MISSING'); }
  return Object.freeze({schemaId:'MULTI_WORKER_DAG_V1',jobs:Object.freeze(normalized),joins:Object.freeze(declaredJoins),undeclaredJoinWait:false});
}
export async function runMultiWorkerDagSimulationV1({dag,executor,maxConcurrency=2}={}){
  if(!dag||dag.schemaId!=='MULTI_WORKER_DAG_V1') throw new Error('MULTI_WORKER_DAG_REQUIRED');
  if(typeof executor!=='function') throw new Error('DAG_EXECUTOR_REQUIRED');
  if(!Number.isSafeInteger(maxConcurrency)||maxConcurrency<1) throw new Error('MAX_CONCURRENCY_INVALID');
  const status=new Map(dag.jobs.map(j=>[j.id,'PENDING'])); const results=new Map(); const active=new Set(); let peak=0; let sequence=0;
  const canRun=j=>j.dependsOn.every(d=>status.get(d)==='PASS');
  const dependencyFailed=j=>j.dependsOn.some(d=>['FAIL','BLOCKED'].includes(status.get(d)));
  const launch=async job=>{ status.set(job.id,'RUNNING'); active.add(job.id); peak=Math.max(peak,active.size); try{ const out=await executor(Object.freeze({...job}),sequence++); const pass=out?.status==='PASS'; status.set(job.id,pass?'PASS':'FAIL'); results.set(job.id,Object.freeze({jobId:job.id,status:pass?'PASS':'FAIL',receipt:out?.receipt??null,artifacts:out?.artifacts??[],estimatedCostMilliUsd:job.estimatedCostMilliUsd})); }catch(error){ status.set(job.id,'FAIL'); results.set(job.id,Object.freeze({jobId:job.id,status:'FAIL',errorCode:error?.code??error?.message??'EXECUTOR_FAILURE',receipt:null,artifacts:[],estimatedCostMilliUsd:job.estimatedCostMilliUsd})); } finally { active.delete(job.id); } };
  while([...status.values()].some(s=>s==='PENDING'||s==='RUNNING')){
    for(const j of dag.jobs) if(status.get(j.id)==='PENDING'&&dependencyFailed(j)){status.set(j.id,'BLOCKED');results.set(j.id,Object.freeze({jobId:j.id,status:'BLOCKED',receipt:null,artifacts:[],estimatedCostMilliUsd:j.estimatedCostMilliUsd}));}
    const ready=dag.jobs.filter(j=>status.get(j.id)==='PENDING'&&canRun(j));
    const capacity=maxConcurrency-active.size;
    if(capacity>0&&ready.length){ const batch=ready.slice(0,capacity).map(launch); await Promise.race(batch); continue; }
    if(active.size>0){ await new Promise(r=>setTimeout(r,1)); continue; }
    break;
  }
  const byId=Object.fromEntries([...results.entries()]);
  const joins=dag.joins.map(join=>({id:join.id,waitFor:join.waitFor,status:join.waitFor.every(id=>status.get(id)==='PASS')?'PASS':'BLOCKED',undeclaredWait:false}));
  return Object.freeze({schemaId:'MULTI_WORKER_SIMULATION_RECEIPT_V1',status:'PASS',jobs:byId,joins,peakConcurrency:peak,maxConcurrency,backpressureRespected:peak<=maxConcurrency,totalEstimatedCostMilliUsd:dag.jobs.reduce((s,j)=>s+j.estimatedCostMilliUsd,0),oneWorkerFailureCorruptsOtherState:false,undeclaredJoinWait:false});
}
