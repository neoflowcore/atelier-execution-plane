import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const sourceSha='564b303b5a2262fd49cf066846c1f19571ef184b';
const expectedModuleSha256='5daf10ef7bc0f0163866b23325f6c4172c1730b04bd2539992ba9ad6f0263ffa';
const source=await readFile(new URL('./runtime-power-v1.mjs',import.meta.url),'utf8');
if(hash(source)!==expectedModuleSha256)throw Error('POWER_BUNDLED_MODULE_DRIFT');
let raw='';for await(const part of process.stdin){raw+=part;if(raw.length>16384)throw Error('POWER_INPUT_LIMIT');}
const input=JSON.parse(raw);
const allowed=['profileId','projectKey','accountId','planSha256','selection'];
if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('POWER_INPUT_SCHEMA');
if(typeof input.profileId!=='string'||!input.profileId||input.profileId.length>256)throw Error('POWER_PROFILE_REQUIRED');
const projectKey=input.projectKey??'cloudflare-inspection';
if(!/^[a-zA-Z0-9_-]{1,80}$/.test(projectKey))throw Error('POWER_PROJECT_REQUIRED');
if(input.accountId!==undefined&&!/^[0-9a-f]{32}$/.test(input.accountId))throw Error('POWER_ACCOUNT_REQUIRED');
if(input.planSha256!==undefined&&!/^[0-9a-f]{64}$/.test(input.planSha256))throw Error('POWER_PLAN_REQUIRED');
if(input.selection!==undefined&&(!input.selection||!['WORKERS','PAGES','D1','R2'].includes(input.selection.kind)||typeof input.selection.resourceId!=='string'||!input.selection.resourceId||input.selection.resourceId.length>256||Object.keys(input.selection).some(k=>!['kind','resourceId'].includes(k))))throw Error('POWER_SELECTION_REQUIRED');
const provenance=input.planSha256?'CALLER_PLAN_BINDING_ONLY':'PLUGIN_RECIPE_ONLY';
const planSha256=input.planSha256??hash(JSON.stringify({workflow:'cloudflare-runtime-power',version:'0.1.0',action:'INSPECT',projectKey}));
const config={...input,projectKey,sourceSha,planSha256,provenance};
const code='async()=>{\n'+source.replaceAll('export ','')+'\nconst input='+JSON.stringify(config)+';\n'+
'const power=createCloudflareRuntimePowerV1({request:opts=>cloudflare.request(opts),whoami:async()=>({id:input.profileId})});\n'+
'const catalog=await power.discover({accountId:input.accountId,projectKey:input.projectKey,sourceSha:input.sourceSha,planSha256:input.planSha256});\n'+
'const selection=input.selection?await compileRuntimePowerSelectionV1({catalog,projectKey:input.projectKey,sourceSha:input.sourceSha,planSha256:input.planSha256,profileId:input.profileId,accountId:catalog.accountId,kind:input.selection.kind,resourceId:input.selection.resourceId,nowMs:Date.now()}):null;\n'+
'return {schemaId:catalog.schemaId,sourceSha:catalog.sourceSha,planProvenance:input.provenance,catalogDigest:catalog.catalogDigest,products:Object.fromEntries(Object.entries(catalog.products).map(([k,v])=>[k,{status:v.status,count:v.resources?.length??null,scope:v.scope}])),selection,providerMutations:0,credentialValuesReturned:false,finalRuntimeAcceptance:false};\n}';
process.stdout.write(code);
