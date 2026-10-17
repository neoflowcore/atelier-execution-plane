function obj(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
export function compileAuthoritativeJobSnapshotV1({runtimeState,sidecarObservation,generatedAt}={}){
  if(!obj(runtimeState)) throw new Error('RUNTIME_STATE_REQUIRED');
  if(!obj(sidecarObservation)) throw new Error('SIDECAR_OBSERVATION_REQUIRED');
  if(typeof runtimeState.executionId!=='string'||!runtimeState.executionId) throw new Error('EXECUTION_ID_REQUIRED');
  const runtimeAuthoritativeFields=['executionId','attemptId','fenceToken','authorityState','acceptanceState','cancelState'];
  const projection={...sidecarObservation};
  for(const key of runtimeAuthoritativeFields) if(key in runtimeState) projection[key]=runtimeState[key];
  return Object.freeze({schemaId:'AUTHORITATIVE_JOB_SNAPSHOT_V1',generatedAt:generatedAt??null,runtimeAuthorityPrecedence:true,sidecarMayOverrideRuntimeAuthority:false,job:Object.freeze(projection)});
}
export function renderJobSnapshotReadSurfaceV1(snapshot,{format='JSON'}={}){
  if(!snapshot||snapshot.schemaId!=='AUTHORITATIVE_JOB_SNAPSHOT_V1') throw new Error('JOB_SNAPSHOT_REQUIRED');
  if(!['JSON','COMPACT'].includes(format)) throw new Error('SNAPSHOT_FORMAT_UNSUPPORTED');
  const body=format==='JSON'?snapshot:{schemaId:snapshot.schemaId,executionId:snapshot.job.executionId,attemptId:snapshot.job.attemptId,state:snapshot.job.authorityState,acceptance:snapshot.job.acceptanceState,providerClass:snapshot.job.providerClass??null,transport:snapshot.job.transport??null};
  return Object.freeze({schemaId:'JOB_SNAPSHOT_READ_SURFACE_V1',readOnly:true,format,body});
}
