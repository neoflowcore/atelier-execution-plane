import { createHash } from 'node:crypto';
function canon(v){if(v===null)return'null';if(typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);if(typeof v==='number'){if(!Number.isSafeInteger(v))throw new Error('EXECUTION_PACKAGE_NON_SAFE_INTEGER');return JSON.stringify(v);}if(Array.isArray(v))return`[${v.map(canon).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;throw new Error('EXECUTION_PACKAGE_UNSUPPORTED_TYPE');}
const sha=v=>createHash('sha256').update(canon(v),'utf8').digest('hex');
export function buildExecutionPackageV1(input={}){
  const required=['jobContract','sourceAuthority','preOperationAttestation','inputManifest','runtimeBootstrap','executionEntrypoint','projectExecutionDeclaration','evidenceSchema','artifactDestination','teardownInstructions'];
  for(const key of required)if(input[key]===undefined||input[key]===null)throw new Error(`EXECUTION_PACKAGE_${key.toUpperCase()}_REQUIRED`);
  const body={schemaId:'EXECUTION_PACKAGE_V1',...Object.fromEntries(required.map(k=>[k,input[k]]))};
  return Object.freeze({...body,EXECUTION_PACKAGE_SHA256:sha(body)});
}
export function compilePreOperationAttestationV1(input={}){
  const requiredTrue=['sourceIdentityVerified','inputsVerified','runtimeFingerprintVerified','providerTargetVerified','credentialScopeVerified','costAdmissionPass','executionPackageVerified'];
  const failures=requiredTrue.filter(k=>input[k]!==true);
  const body={schemaId:'PRE_OPERATION_ATTESTATION_V1',requiresPaidCompute:false,failures,status:failures.length?'FAIL':'PASS'};
  return Object.freeze({...body,ATTESTATION_SHA256:sha(body)});
}
