#!/usr/bin/env node
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdir,writeFile} from "node:fs/promises";
import {V006_NEGATIVE_FIXTURE_IDS_V1,evaluateV006NegativeFixtureV1,aggregateV006NegativeFixturesV1} from "../v006/conformance-v1.mjs";
import {compileV006SourceClosureV1,V006_CREDENTIAL_INDEPENDENT_NODES_V1} from "../v006/source-closure-v1.mjs";
const exec=promisify(execFile);
const head=(await exec("git",["rev-parse","HEAD"],{encoding:"utf8"})).stdout.trim();
const tree=(await exec("git",["rev-parse","HEAD^{tree}"],{encoding:"utf8"})).stdout.trim();
const fixtureInputs={
F01:{sourceHeadChanged:true},F02:{wrongProject:true},F03:{executorSuccess:true,targetStateUnchanged:true},F04:{resumeSignal:true,mutationComplete:false},F05:{singleUseOutcome:"UNKNOWN"},F06:{destructiveAcrossReadbackBoundary:true},F07:{cancelled:true,lateCompletion:true},F08:{protocolStale:true},F09:{rawCredentialInCapsule:true},F10:{durableAuthWrongScope:true},F11:{autoMintRequired:true,legacyFallbackUsed:true},F12:{shortLivedExpired:true},F13:{tokenMintFailed:true},F14:{transportUnreachable:true},F15:{exitPathUnknown:true},F16:{partialCompletion:true},F17:{newChatDuringWait:true},F18:{supersededByNewerSourceOrPlan:true},F19:{unexpectedArtifact:true},F20:{manualStateMutation:true},F21:{twoExecutorsSameStateChangingHandoff:true},F22:{twoWritesSameTarget:true},F23:{independentTargets:true},F24:{executorCapabilityMismatch:true},F25:{dataPolicyForbidsEgress:true},F26:{payloadDigestTampered:true},F27:{preActuationTargetDrift:true},F28:{oldExecutorProtocol:true},F29:{revokedOfflineThenLate:true},F30:{zeroActionsProfile:true,actionsSelected:true},F31:{cachedHandoffWithoutRevalidation:true},F32:{diagnosticsLostBeforeTeardown:true},F33:{externalSourceMutationWithoutCompiler:true},F34:{durableAuthorityRevoked:true},F35:{durableAuthorityRotated:true},F36:{validCredentialWrongAttempt:true},F37:{multipleIndependentHandoffs:true},F38:{receiptChainDigestBroken:true}
};
const fixtureReceipts=V006_NEGATIVE_FIXTURE_IDS_V1.map(id=>evaluateV006NegativeFixtureV1(id,fixtureInputs[id]));
const fixtureMatrix=aggregateV006NegativeFixturesV1(fixtureReceipts);
if(fixtureMatrix.status!=="PASS")throw new Error("V006_FIXTURE_MATRIX_NOT_PASS");
const closure=compileV006SourceClosureV1({completedNodes:V006_CREDENTIAL_INDEPENDENT_NODES_V1,fixtureStatus:fixtureMatrix.status,liveAuthoritiesCompiled:true,minScopesCompiled:true,existingAuthReuseEvaluated:true,finalAuthBindManifestCompiled:true});
if(closure.status!=="PASS")throw new Error("V006_SOURCE_CLOSURE_NOT_PASS");
const body={
 schemaId:"EP52_V006_HORIZON1_SOURCE_CLOSURE_RECEIPT_V1",
 sourceHead:head,sourceTree:tree,
 plan:{version:"v006-v001",planSha256:"d93a01f6658b780f7c0ffda658cf34d62632ad5473f1bc167e1f624f61677118",validationSha256:"b55e1f1fb7cd004a5729fc73869add9d8026121f3a64e5e8fccf59a8f145bbb7",bundleSha256:"0962bf70904294d5449e30e17f198f8d77aeb1ef8f122c83e82069f4fc951b45"},
 predecessorClosure:{preserved:true,classification:"HISTORICAL_PREDECESSOR_SOURCE_CLOSURE",nodeCount:43},
 v006Closure:closure,
 fixtureMatrix,
 currentHorizon1CredentialIndependentWorkExhausted:true,
 vmwareRequiredForSourceClosure:false,
 liveReferences:{R1:"PENDING",R2:"PENDING",R3:"PENDING",R4:"PENDING",R5:"PENDING",R6:"PENDING"},
 predecessorDigitalOceanLifecycle:{status:"PASS",promotionToV006Reference:"DENY_WITHOUT_V006_HANDOFF_AND_ACCEPTANCE"},
 nextLegalClass:"V006_LIVE_REFERENCE_OR_PREDECESSOR_REQUIRED_LIVE",
 horizon2StartAllowed:false,
 horizon2BlockReason:"HORIZON1_EXECUTION_PLANE_INTEGRATION_SEAL_REQUIRED"
};
await mkdir("artifacts/ep52/v006",{recursive:true});
await writeFile("artifacts/ep52/v006/source-closure.json",JSON.stringify(body,null,2)+"\n");
console.log(`EP52_V006_SOURCE_CLOSURE=PASS head=${head} nodes=${closure.requiredNodeCount} fixtures=${fixtureMatrix.requiredFixtureCount}`);
