import { randomUUID } from 'node:crypto';
export function createSecretBrokerV1(){
  const store=new Map();
  return Object.freeze({
    issue({secret,scope,expiresAtMs}){if(typeof secret!=='string'||!secret)throw new Error('SECRET_REQUIRED');if(typeof scope!=='string'||!scope)throw new Error('SECRET_SCOPE_REQUIRED');if(!Number.isSafeInteger(expiresAtMs))throw new Error('SECRET_EXPIRY_REQUIRED');const ref=`secret://${randomUUID()}`;store.set(ref,{secret,scope,expiresAtMs,revoked:false});return Object.freeze({credentialRef:ref,scope,expiresAtMs,rawSecretPersisted:false});},
    resolve(ref,{nowMs}){const item=store.get(ref);if(!item||item.revoked)throw new Error('CREDENTIAL_REF_INVALID');if(nowMs>item.expiresAtMs)throw new Error('CREDENTIAL_EXPIRED');return item.secret;},
    revoke(ref){const item=store.get(ref);if(!item)return Object.freeze({credentialRef:ref,revoked:true,alreadyAbsent:true});item.revoked=true;item.secret='';return Object.freeze({credentialRef:ref,revoked:true,alreadyAbsent:false});},
    inspect(ref){const item=store.get(ref);if(!item)return Object.freeze({exists:false});return Object.freeze({exists:true,scope:item.scope,expiresAtMs:item.expiresAtMs,revoked:item.revoked,rawSecretPersisted:false});}
  });
}
