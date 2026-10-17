import {createHash,randomUUID} from "node:crypto";
export function canonicalJsonV1(v){
  if(v===null)return"null";
  if(typeof v==="string"||typeof v==="boolean")return JSON.stringify(v);
  if(typeof v==="number"){if(!Number.isSafeInteger(v))throw new Error("V006_NON_SAFE_INTEGER");return JSON.stringify(v);}
  if(Array.isArray(v))return"["+v.map(canonicalJsonV1).join(",")+"]";
  if(v&&typeof v==="object")return"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonicalJsonV1(v[k])).join(",")+"}";
  throw new Error("V006_UNSUPPORTED_VALUE");
}
export const sha256V1=v=>createHash("sha256").update(canonicalJsonV1(v),"utf8").digest("hex");
export function reqStringV1(v,code){if(typeof v!=="string"||!v)throw new Error(code);return v;}
export function reqIntV1(v,code){if(!Number.isSafeInteger(v))throw new Error(code);return v;}
export const idV1=prefix=>prefix+":"+randomUUID();
export function assertNoRawSecretMaterialV1(value){
  const text=JSON.stringify(value??null);
  const patterns=[/-----BEGIN [A-Z ]*PRIVATE KEY-----/i,/"password"\s*:/i,/"token"\s*:/i,/"secret"\s*:/i,/gh[pousr]_[A-Za-z0-9_]{20,}/,/do[p]?_v1_[A-Za-z0-9]{20,}/i];
  if(patterns.some(r=>r.test(text)))throw new Error("V006_RAW_SECRET_MATERIAL_DENIED");
  return true;
}
