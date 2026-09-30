import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {MAX_COST_CAP_MILLI_USD,MAX_TTL_SECONDS,DIGITALOCEAN_ALLOWED_SURFACE_CLASSES} from "../providers/digitalocean/api-execution-v1.mjs";

const root=resolve(import.meta.dirname,"..");
const authority=JSON.parse(await readFile(resolve(root,"docs/EP52_P19_AUTH_ENDGAME_AUTHORITY_v001.json"),"utf8"));

assert.equal(authority.schemaId,"EP52_P19_AUTH_ENDGAME_AUTHORITY_V1");
assert.equal(authority.explicitUserApproval,true);
assert.equal(authority.approvalScope,"MINIMUM_COST_LIVE_QUALIFICATION_ONLY");
assert.equal(authority.authInteractionBudget,1);
assert.equal(authority.perProviderMicroAuth,false);
assert.equal(authority.rawSecretChatPath,false);
assert.equal(authority.costEnvelope.maxConcurrentPaidResources,1);
assert.equal(authority.costEnvelope.maxPaidComputeMilliUsdPerResource,MAX_COST_CAP_MILLI_USD);
assert.equal(authority.costEnvelope.maxTtlSeconds,MAX_TTL_SECONDS);
assert.equal(authority.costEnvelope.additionalBillableResourcesAllowed,false);
assert.equal(authority.digitalOcean.officialOrFirstPartySurfaceRequired,true);
assert.equal(authority.digitalOcean.minimumEligibleSizeRequired,true);
assert.equal(authority.digitalOcean.createOnlyAfterFreshInventoryAndPricingReadback,true);
assert.equal(authority.digitalOcean.deleteOrTerminateRequired,true);
assert.equal(authority.digitalOcean.deleteReadbackRequired,true);
assert.equal(authority.digitalOcean.childBillableArtifactScanRequired,true);
assert.equal(authority.digitalOcean.residueZeroRequired,true);
assert.equal(authority.vmware.existingInfrastructureOnly,true);
assert.equal(authority.vmware.newPaidResourceAllowed,false);
assert.equal(authority.vmware.manualSshNormalPath,false);
assert.equal(authority.github.reuseExistingAuth,true);
assert.equal(authority.github.workerDeviceLoginAllowed,false);
assert.equal(authority.github.longLivedCredentialOnWorkerAllowed,false);

const allowed=[...DIGITALOCEAN_ALLOWED_SURFACE_CLASSES].sort();
assert.deepEqual(allowed,["BUILTIN_PROVIDER_API_ADAPTER","FIRST_PARTY_OFFICIAL_CONNECTOR","OFFICIAL_NATIVE_API"]);

console.log(JSON.stringify({
  schemaId:"EP52_LIVE_AUTHORITY_LOCK_VERIFICATION_V1",
  status:"PASS",
  digitalOceanCostCapMilliUsd:MAX_COST_CAP_MILLI_USD,
  digitalOceanTtlSeconds:MAX_TTL_SECONDS,
  digitalOceanAllowedSurfaceClasses:allowed,
  vmwareExistingInfrastructureOnly:true,
  githubExistingAuthReuse:true,
  authInteractionBudget:1
},null,2));
