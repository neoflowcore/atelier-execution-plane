import {createHash} from 'node:crypto';
const sha=v=>createHash('sha256').update(JSON.stringify(v),'utf8').digest('hex');
const REQUIRED_SOURCE_NODES=Object.freeze(['EP52-P0','EP52-P1','EP52-P2','EP52-P3','EP52-P4','EP52-P5','EP52-P6','EP52-P7','EP52-P8','EP52-P9','EP52-P10','EP52-P11','EP52-P12','EP52-P13','EP52-P14','EP52-P15','EP52-P16','EP52-P17','P20-LIVE-HARNESS','P21-WORKLOAD-HARNESS','P22-BILLING-HARNESS','P23-FREEZE-COMPILER','P24-SEAL-HANDOFF-COMPILER','COMPAT-REBIND-COMPILER','INTEGRATION-LIVE-HARNESS','INTEGRATION-SEAL-COMPILER']);
export function compileCredentialIndependentClosurePreflightV1({completedSourceNodes=[],liveRequirements=[]}={}){
  const complete=new Set(completedSourceNodes); const missing=REQUIRED_SOURCE_NODES.filter(x=>!complete.has(x));
  const dedup=new Map(); for(const req of liveRequirements){ if(!req||typeof req.id!=='string'||!req.id) throw new Error('LIVE_REQUIREMENT_ID_REQUIRED'); if(!dedup.has(req.id)) dedup.set(req.id,{...req}); }
  const requirements=[...dedup.values()].sort((a,b)=>a.id.localeCompare(b.id));
  const pass=missing.length===0;
  const body={schemaId:'EP_AUTH_ENDGAME_CLOSURE_PREFLIGHT_V1',status:pass?'PASS':'DEFER_CONTINUE_SOURCE_PROGRESS',EXECUTION_PLANE_CREDENTIAL_INDEPENDENT_WORK_EXHAUSTED:pass,NO_NEXT_CREDENTIAL_INDEPENDENT_WORK:pass,requiresLiveAuth:requirements.some(x=>x.requiresAuth===true),requiresPaidCompute:requirements.some(x=>x.requiresPaidCompute===true),requirements,missingSourceNodes:missing,authInteractionBudget:1,perProviderMicroAuth:false};
  return Object.freeze({...body,preflightDigest:sha(body)});
}
export {REQUIRED_SOURCE_NODES};
