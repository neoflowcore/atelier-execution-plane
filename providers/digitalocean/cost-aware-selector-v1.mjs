const MIN_BILLING_SECONDS=60;
const MIN_BILLING_MILLI_USD=10;
function positive(v,name){if(typeof v!=="number"||!Number.isFinite(v)||v<=0)throw new Error(name);return v}
function posInt(v,name){if(!Number.isSafeInteger(v)||v<=0)throw new Error(name);return v}
export function estimateDigitalOceanDropletCostMilliUsdV1({priceHourly,ttlSeconds}={}){
  positive(priceHourly,"DIGITALOCEAN_PRICE_HOURLY_REQUIRED");
  posInt(ttlSeconds,"DIGITALOCEAN_TTL_REQUIRED");
  const billedSeconds=Math.max(MIN_BILLING_SECONDS,ttlSeconds);
  return Math.max(MIN_BILLING_MILLI_USD,Math.ceil(priceHourly*(billedSeconds/3600)*1000));
}
export function selectMinimumDropletForLiveQualificationV1({requirements,sizes,region,ttlSeconds,costCapMilliUsd}={}){
  if(!requirements||typeof requirements!=="object")throw new Error("DIGITALOCEAN_REQUIREMENTS_REQUIRED");
  if(!Array.isArray(sizes))throw new Error("DIGITALOCEAN_SIZES_REQUIRED");
  if(typeof region!=="string"||!region)throw new Error("DIGITALOCEAN_REGION_REQUIRED");
  posInt(ttlSeconds,"DIGITALOCEAN_TTL_REQUIRED");posInt(costCapMilliUsd,"DIGITALOCEAN_COST_CAP_REQUIRED");
  const eligible=sizes.filter(s=>{
    const ph=Number(s.price_hourly??s.priceHourly);
    if(s.available===false||!Number.isFinite(ph)||ph<=0)return false;
    const regs=Array.isArray(s.regions)?s.regions:[];
    if(regs.length&&!regs.includes(region))return false;
    if((s.vcpus??0)<(requirements.minCpu??1))return false;
    if((s.memory??0)<(requirements.minMemoryMiB??512))return false;
    if((s.disk??0)<(requirements.minDiskGiB??5))return false;
    return estimateDigitalOceanDropletCostMilliUsdV1({priceHourly:ph,ttlSeconds})<=costCapMilliUsd;
  }).map(s=>({...s,priceHourly:Number(s.price_hourly??s.priceHourly),projectedCostMilliUsd:estimateDigitalOceanDropletCostMilliUsdV1({priceHourly:Number(s.price_hourly??s.priceHourly),ttlSeconds})}))
    .sort((a,b)=>a.projectedCostMilliUsd-b.projectedCostMilliUsd||a.priceHourly-b.priceHourly||a.vcpus-b.vcpus||a.memory-b.memory||a.disk-b.disk||String(a.slug).localeCompare(String(b.slug)));
  if(!eligible.length)throw new Error("NO_DIGITALOCEAN_SIZE_WITHIN_REQUIREMENTS_AND_COST_CAP");
  return Object.freeze(eligible[0]);
}
export {MIN_BILLING_SECONDS,MIN_BILLING_MILLI_USD};
