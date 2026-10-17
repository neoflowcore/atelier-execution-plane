// Capability planning only. Tool metadata is not authentication or execution authority.
const CF='mcp__codex_apps__cloudflare_runtime_';
const DO='mcp__codex_apps__digitalocean_';
export function assessProviderCapabilitiesV1(tools){
 if(!Array.isArray(tools)||tools.some(t=>!t||typeof t.name!=='string'||typeof t.description!=='string'))throw Error('CAPABILITY_SCHEMA');
 if(new Set(tools.map(t=>t.name)).size!==tools.length)throw Error('CAPABILITY_DUPLICATE');
 const names=new Set(tools.map(t=>t.name));
 const has=n=>names.has(n);
 // Schema must be supplied by the trusted tool registry adapter, not inferred from prose.
 const fields=n=>tools.find(t=>t.name===n)?.inputSchema?.properties;
 const createFields=fields(DO+'droplet_create');
 const required=['Name','Region','Size'];
 const creation=has(DO+'droplet_create')&&!!createFields&&required.every(k=>Object.hasOwn(createFields,k));
 const bootstrap=creation&&Object.hasOwn(createFields,'user_data');
 return Object.freeze({
  schemaId:'RUNTIME_PROVIDER_CAPABILITIES_V1',
  cloudflare:{discovery:has(CF+'whoami')&&has(CF+'search')&&has(CF+'execute'),executionSurface:has(CF+'execute')?'GENERIC_API':'UNAVAILABLE'},
  digitalocean:{inventory:has(DO+'droplet_list'),createSchema:!has(DO+'droplet_create')?'UNAVAILABLE':createFields?'OBSERVED':'UNKNOWN',bootstrap,cleanup:has(DO+'droplet_get')&&has(DO+'droplet_delete')},
  browserExtensionRequired:false,providerMutations:0,executionAuthorized:false
 });
}
export function planProviderRouteV1({capabilities,provider,operation}={}){
 if(capabilities?.schemaId!=='RUNTIME_PROVIDER_CAPABILITIES_V1')throw Error('CAPABILITY_REQUIRED');
 if(!['cloudflare','digitalocean'].includes(provider)||!['INSPECT','BOOTSTRAP_JOB'].includes(operation))throw Error('CAPABILITY_OPERATION');
 let route='UNAVAILABLE',reason='REQUIRED_CAPABILITY_MISSING';
 if(operation==='INSPECT'){
  const available=provider==='cloudflare'?capabilities.cloudflare?.discovery:capabilities.digitalocean?.inventory;
  if(available){route='CONNECTED_PLUGIN';reason='READ_ONLY_INSPECTION';}
 }else if(provider==='digitalocean'){
  if(capabilities.digitalocean?.bootstrap&&capabilities.digitalocean?.cleanup){route='CONNECTED_PLUGIN_CANDIDATE';reason='LIVE_PREFLIGHT_STILL_REQUIRED';}
  else {route='OFFICIAL_API_ADAPTER_REQUIRED';reason=capabilities.digitalocean?.createSchema==='UNKNOWN'?'CREATE_SCHEMA_UNOBSERVED':'BOOTSTRAP_OR_CLEANUP_MISSING';}
 }
 return Object.freeze({schemaId:'RUNTIME_PROVIDER_ROUTE_V1',provider,operation,route,reason,
  executionAuthorized:false,requiresFreshIdentity:true,requiresProviderAuthorization:true,
  requiresCostTtlCleanup:operation==='BOOTSTRAP_JOB',browserExtensionRequired:false,providerMutations:0});
}
