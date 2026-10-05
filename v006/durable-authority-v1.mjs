import {reqIntV1,reqStringV1,sha256V1} from "./core-util-v1.mjs";
export function compileDurableAuthorityV1(input={}){
  const body={schemaId:"V006_DURABLE_AUTHORITY_V1",authorityId:reqStringV1(input.authorityId,"V006_AUTHORITY_ID_REQUIRED"),credentialClass:reqStringV1(input.credentialClass,"V006_CREDENTIAL_CLASS_REQUIRED"),sourceClass:reqStringV1(input.sourceClass,"V006_SOURCE_CLASS_REQUIRED"),issuer:reqStringV1(input.issuer,"V006_ISSUER_REQUIRED"),scope:[...new Set(input.scope??[])].sort(),targetIdentity:reqStringV1(input.targetIdentity,"V006_TARGET_IDENTITY_REQUIRED"),revocable:input.revocable!==false,status:input.status??"ACTIVE",secretValuePersisted:false,parallelCredentialLedger:false};
  return Object.freeze({...body,authorityDigest:sha256V1(body)});
}
export function compileCredentialProvenanceAttestationV1(input={}){
  const body={schemaId:"V006_CREDENTIAL_PROVENANCE_SCOPE_ATTESTATION_V1",credentialRef:reqStringV1(input.credentialRef,"V006_CREDENTIAL_REF_REQUIRED"),credentialClass:reqStringV1(input.credentialClass,"V006_CREDENTIAL_CLASS_REQUIRED"),sourceClass:reqStringV1(input.sourceClass,"V006_SOURCE_CLASS_REQUIRED"),issuer:reqStringV1(input.issuer,"V006_ISSUER_REQUIRED"),scope:[...new Set(input.scope??[])].sort(),targetIdentity:reqStringV1(input.targetIdentity,"V006_TARGET_IDENTITY_REQUIRED"),mintAuthorityRef:reqStringV1(input.mintAuthorityRef,"V006_MINT_AUTHORITY_REF_REQUIRED"),issuedAtMs:reqIntV1(input.issuedAtMs,"V006_ISSUED_AT_REQUIRED"),expiresAtMs:reqIntV1(input.expiresAtMs,"V006_EXPIRES_AT_REQUIRED"),projectRunBinding:reqStringV1(input.projectRunBinding,"V006_PROJECT_RUN_BINDING_REQUIRED"),attemptBinding:reqStringV1(input.attemptBinding,"V006_ATTEMPT_BINDING_REQUIRED"),revocable:input.revocable!==false,observedAtMs:reqIntV1(input.observedAtMs,"V006_OBSERVED_AT_REQUIRED"),rawSecretPersisted:false};
  if(body.expiresAtMs<=body.issuedAtMs)throw new Error("V006_CREDENTIAL_EXPIRY_INVALID");
  return Object.freeze({...body,attestationDigest:sha256V1(body)});
}
export function evaluateCredentialAttestationV1({attestation,allowedSourceClasses=[],requiredScope=[],targetIdentity,projectRunBinding,attemptBinding,nowMs}={}){
  if(!attestation||attestation.schemaId!=="V006_CREDENTIAL_PROVENANCE_SCOPE_ATTESTATION_V1")return Object.freeze({ready:false,code:"CREDENTIAL_ATTESTATION_REQUIRED"});
  const failures=[];
  if(!allowedSourceClasses.includes(attestation.sourceClass))failures.push("AUTH_SOURCE_NOT_ALLOWED");
  for(const s of requiredScope)if(!attestation.scope.includes(s))failures.push("AUTH_SCOPE_MISSING:"+s);
  if(attestation.targetIdentity!==targetIdentity)failures.push("AUTH_TARGET_MISMATCH");
  if(attestation.projectRunBinding!==projectRunBinding)failures.push("AUTH_PROJECT_RUN_MISMATCH");
  if(attestation.attemptBinding!==attemptBinding)failures.push("AUTH_ATTEMPT_MISMATCH");
  if(!Number.isSafeInteger(nowMs)||nowMs>=attestation.expiresAtMs)failures.push("AUTH_EXPIRED");
  return Object.freeze({ready:failures.length===0,code:failures.length?"CREDENTIAL_ATTEST_FAIL":"EXECUTION_AUTH_READY",failures});
}
export async function mintEphemeralCredentialV1({durableAuthority,secretBroker,mint,scope,targetIdentity,projectRunBinding,attemptBinding,nowMs,ttlMs=300000}={}){
  if(!durableAuthority||durableAuthority.schemaId!=="V006_DURABLE_AUTHORITY_V1")throw new Error("V006_DURABLE_AUTHORITY_REQUIRED");
  if(durableAuthority.status!=="ACTIVE")throw new Error("V006_DURABLE_AUTHORITY_REVOKED");
  if(typeof mint!=="function")throw new Error("V006_MINT_FUNCTION_REQUIRED");
  if(!secretBroker||typeof secretBroker.issue!=="function")throw new Error("V006_EXISTING_SECRET_BROKER_REQUIRED");
  const requested=[...new Set(scope??[])].sort();
  if(requested.some(s=>!durableAuthority.scope.includes(s)))throw new Error("V006_MINT_SCOPE_EXCEEDS_DURABLE_AUTHORITY");
  if(targetIdentity!==durableAuthority.targetIdentity)throw new Error("V006_MINT_TARGET_MISMATCH");
  const opaque=await mint({authorityId:durableAuthority.authorityId,scope:requested,targetIdentity,attemptBinding});
  if(typeof opaque!=="string"||!opaque)throw new Error("V006_MINT_RETURNED_NO_CREDENTIAL");
  const issuedAtMs=nowMs,expiresAtMs=nowMs+ttlMs;
  const ref=secretBroker.issue({secret:opaque,scope:requested.join(" "),expiresAtMs});
  return compileCredentialProvenanceAttestationV1({credentialRef:ref.credentialRef,credentialClass:"EPHEMERAL",sourceClass:"AUTO_MINT",issuer:durableAuthority.issuer,scope:requested,targetIdentity,mintAuthorityRef:durableAuthority.authorityId,issuedAtMs,expiresAtMs,projectRunBinding,attemptBinding,revocable:true,observedAtMs:nowMs});
}
