const FORBIDDEN_KEYS=new Set(['providerImplementation','providerClass','providerId','apiToken','token','password','secret','rawSecret','credential']);
function scan(value,path='$',errors=[]){ if(!value||typeof value!=='object') return errors; for(const [k,v] of Object.entries(value)){ const p=`${path}.${k}`; if(FORBIDDEN_KEYS.has(k)) errors.push(`FORBIDDEN_PROJECT_DECLARATION_FIELD:${p}`); if(typeof v==='object') scan(v,p,errors); } return errors; }
export function validateProjectExecutionDeclarationV1(decl={}){
  const errors=scan(decl); if(decl.schemaVersion!=='1') errors.push('SCHEMA_VERSION_1_REQUIRED');
  if(!decl.environmentProfile||typeof decl.environmentProfile!=='object') errors.push('ENVIRONMENT_PROFILE_REQUIRED');
  if(!decl.taskProfiles||typeof decl.taskProfiles!=='object'||Array.isArray(decl.taskProfiles)) errors.push('TASK_PROFILES_REQUIRED');
  return Object.freeze({ok:errors.length===0,errors,providerImplementationLogic:false,rawSecretPresent:errors.some(x=>/token|secret|password|credential/i.test(x))});
}
export function compileProviderNeutralRequirementV1({declaration,taskProfile}={}){
  const v=validateProjectExecutionDeclarationV1(declaration); if(!v.ok) throw new Error(`PROJECT_DECLARATION_INVALID:${v.errors.join(',')}`);
  const task=declaration.taskProfiles[taskProfile]; if(!task) throw new Error('TASK_PROFILE_NOT_FOUND');
  const env=declaration.environmentProfile;
  const requirements={os:env.os??null,arch:env.arch??null,node:env.node??null,minCpu:task.minCpu??1,minMemoryMiB:task.minMemoryMiB??512,minDiskGiB:task.minDiskGiB??5,requiresChromium:task.requiresChromium===true,requiresNetwork:task.requiresNetwork===true,executionClass:task.executionClass??'STANDARD'};
  return Object.freeze({schemaId:'PROVIDER_NEUTRAL_REQUIREMENT_V1',taskProfile,requirements,providerSelected:false,providerImplementationLogic:false});
}
