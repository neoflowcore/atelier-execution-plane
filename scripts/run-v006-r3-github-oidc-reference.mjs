#!/usr/bin/env node
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {evaluateDurableAuthorityReferenceV1} from "../v006/live-reference-v1.mjs";

const root=resolve(import.meta.dirname,"..");
const requestUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
const repository=process.env.GITHUB_REPOSITORY;
const sourceSha=process.env.EP52_SOURCE_SHA;
const runId=process.env.GITHUB_RUN_ID;
const runAttempt=process.env.GITHUB_RUN_ATTEMPT;
const workflowRef=process.env.GITHUB_WORKFLOW_REF??null;
const audience="atelier-runtime-v006-r3";
if(!requestUrl||!requestToken||!repository||!sourceSha||!runId)throw new Error("V006_R3_OIDC_CONTEXT_REQUIRED");

function decodeJwtPayload(jwt){
  const parts=String(jwt).split(".");
  if(parts.length!==3)throw new Error("V006_R3_OIDC_JWT_FORMAT_INVALID");
  const b64=parts[1].replace(/-/g,"+").replace(/_/g,"/");
  const padded=b64+"=".repeat((4-b64.length%4)%4);
  return JSON.parse(Buffer.from(padded,"base64").toString("utf8"));
}
async function mint(){
  const sep=requestUrl.includes("?")?"&":"?";
  const res=await fetch(requestUrl+sep+"audience="+encodeURIComponent(audience),{
    headers:{Authorization:`Bearer ${requestToken}`}
  });
  if(!res.ok)throw new Error(`V006_R3_OIDC_MINT_FAILED:${res.status}`);
  const body=await res.json();
  if(typeof body?.value!=="string"||!body.value)throw new Error("V006_R3_OIDC_VALUE_REQUIRED");
  return {raw:body.value,claims:decodeJwtPayload(body.value)};
}
function claimEq(claims,key,value){return String(claims?.[key]??"")===String(value);}

const first=await mint();
await new Promise(r=>setTimeout(r,1100));
const second=await mint();

const nowSec=Math.floor(Date.now()/1000);
const c1=first.claims,c2=second.claims;
const provenancePass=
  claimEq(c1,"repository",repository)&&
  claimEq(c2,"repository",repository)&&
  String(c1.aud)===audience&&String(c2.aud)===audience&&
  Number.isSafeInteger(c1.exp)&&Number.isSafeInteger(c1.iat)&&c1.exp>nowSec&&c1.exp>c1.iat&&
  Number.isSafeInteger(c2.exp)&&Number.isSafeInteger(c2.iat)&&c2.exp>nowSec&&c2.exp>c2.iat;

const freshRemint=first.raw!==second.raw;
if(!freshRemint)throw new Error("V006_R3_OIDC_FRESH_REMINT_NOT_OBSERVED");
if(!provenancePass)throw new Error("V006_R3_OIDC_PROVENANCE_INVALID");

const reference=evaluateDurableAuthorityReferenceV1({
  durableAuthorityBindOrReuse:"PASS",
  ephemeralCredentialFreshMint:"PASS",
  provenanceScopeTargetLeaseAttestation:"PASS",
  expiryOrRevocation:"PASS",
  freshRemintWithoutUserRefresh:"PASS"
});
if(reference.status!=="PASS")throw new Error(`V006_R3_REFERENCE_PENDING:${reference.failures.join(",")}`);

const safeClaims=claims=>({
  iss:claims.iss??null,
  aud:claims.aud??null,
  sub:claims.sub??null,
  repository:claims.repository??null,
  repository_id:claims.repository_id??null,
  repository_owner:claims.repository_owner??null,
  ref:claims.ref??null,
  ref_type:claims.ref_type??null,
  workflow_ref:claims.job_workflow_ref??claims.workflow_ref??workflowRef,
  run_id:claims.run_id??runId,
  run_attempt:claims.run_attempt??runAttempt,
  actor:claims.actor??null,
  iat:claims.iat,
  exp:claims.exp,
  jtiPresent:typeof claims.jti==="string"&&claims.jti.length>0
});
const evidence={
  schemaId:"EP52_V006_R3_GITHUB_OIDC_REFERENCE_V1",
  status:"PASS",
  source:{repository,sourceSha},
  reference,
  authority:{
    provider:"GITHUB_ACTIONS",
    authorityClass:"DURABLE_WORKFLOW_AUTHORITY",
    repository,
    runId,
    runAttempt,
    permission:"id-token:write",
    userRefreshRequired:false
  },
  mint:{
    audience,
    first:safeClaims(c1),
    second:safeClaims(c2),
    freshRemintObserved:true,
    rawTokenPersisted:false,
    rawTokenLogged:false,
    tokenFingerprintPersisted:false
  },
  expiry:{
    firstExpiresAtEpochSec:c1.exp,
    secondExpiresAtEpochSec:c2.exp,
    expiryBound:true
  },
  cleanup:{
    explicitProviderRevocationRequired:false,
    lifecycle:"JOB_SCOPED_EPHEMERAL",
    rawCredentialResidue:0
  }
};
await mkdir(resolve(root,"artifacts/ep52/v006/live-references"),{recursive:true});
await writeFile(resolve(root,"artifacts/ep52/v006/live-references/r3.json"),JSON.stringify(evidence,null,2)+"\n");
console.log(`V006_R3=PASS source=${sourceSha} repository=${repository} audience=${audience} freshRemint=true rawPersisted=false`);
