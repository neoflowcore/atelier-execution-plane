const REQUIRED=Object.freeze([
  ["LOCAL","DIRECT_WORKER"],
  ["VMWARE","DIRECT_WORKER"],
  ["DIGITALOCEAN","DIRECT_WORKER"],
  ["VMWARE","GITHUB_SELF_HOSTED_JIT"],
  ["DIGITALOCEAN","GITHUB_SELF_HOSTED_JIT"]
]);
const key=([p,t])=>`${p}::${t}`;
export function compileProviderTransportLiveMatrixV1(receipts=[]){
  if(!Array.isArray(receipts)) throw new Error("LIVE_MATRIX_RECEIPTS_REQUIRED");
  const map=new Map();
  for(const r of receipts){
    if(!r||typeof r.provider!=="string"||typeof r.transport!=="string"||typeof r.status!=="string") throw new Error("LIVE_MATRIX_RECEIPT_INVALID");
    map.set(key([r.provider,r.transport]),r);
  }
  const combinations=REQUIRED.map(([provider,transport])=>{
    const r=map.get(key([provider,transport]));
    return Object.freeze({provider,transport,status:r?.status??"PENDING_LIVE",evidenceRef:r?.evidenceRef??null});
  });
  const pending=combinations.filter(x=>x.status!=="PASS");
  const providerStatus={
    LOCAL:combinations.filter(x=>x.provider==="LOCAL").every(x=>x.status==="PASS")?"PASS":"PENDING",
    VMWARE:combinations.filter(x=>x.provider==="VMWARE").every(x=>x.status==="PASS")?"PASS":"PENDING",
    DIGITALOCEAN:combinations.filter(x=>x.provider==="DIGITALOCEAN").every(x=>x.status==="PASS")?"PASS":"PENDING"
  };
  const transportStatus={
    DIRECT_WORKER:combinations.filter(x=>x.transport==="DIRECT_WORKER").every(x=>x.status==="PASS")?"PASS":"PENDING",
    GITHUB_SELF_HOSTED_JIT:combinations.filter(x=>x.transport==="GITHUB_SELF_HOSTED_JIT").every(x=>x.status==="PASS")?"PASS":"PENDING"
  };
  return Object.freeze({
    schemaId:"EP52_PROVIDER_TRANSPORT_LIVE_MATRIX_V1",
    combinations,
    pending,
    providerStatus,
    transportStatus,
    PROVIDER_TRANSPORT_INDEPENDENCE:pending.length===0?"PASS":"PENDING",
    WORKER_DEVICE_LOGIN:0,
    LONG_LIVED_PROVIDER_OR_GITHUB_CREDENTIAL_ON_WORKER:0,
    sourcePreparationComplete:true,
    finalLiveGatePass:pending.length===0
  });
}
export {REQUIRED as REQUIRED_PROVIDER_TRANSPORT_COMBINATIONS};
