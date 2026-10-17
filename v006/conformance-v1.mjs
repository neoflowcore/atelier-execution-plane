export const V006_NEGATIVE_FIXTURE_EXPECTED_V1=Object.freeze({
F01:"STALE_HANDOFF_DENY",F02:"IDENTITY_FENCE_FAIL",F03:"ACCEPTANCE_DENY",F04:"AUTHORITATIVE_READBACK_PENDING",F05:"NO_REPLAY_RECONCILE",F06:"BATCH_COMPILER_SPLIT",F07:"LATE_RESULT_QUARANTINE",F08:"HANDSHAKE_DENY",F09:"SECURITY_FAIL",F10:"CREDENTIAL_ATTEST_FAIL",F11:"LEGACY_FALLBACK_FAIL_CLOSED",F12:"AUTO_REMINT",F13:"PAID_RESOURCE_CREATE_ZERO",F14:"PAID_RESOURCE_CREATE_ZERO",F15:"PAID_RESOURCE_CREATE_ZERO",F16:"RECONCILE_AND_RESUME_MISSING_ONLY",F17:"DURABLE_REATTACH_NO_DUPLICATE",F18:"OLD_HANDOFF_REVOKED",F19:"ARTIFACT_QUARANTINE_NO_ACCEPTANCE",F20:"TRUST_RESET_REATTEST",F21:"ONE_ACTIVE_ACTUATOR",F22:"SERIALIZE_OR_CONFLICT_DENY",F23:"SAFE_PARALLEL_PASS",F24:"HANDOFF_DELIVERY_DENY",F25:"HANDOFF_DENY_OR_ALTERNATE_EXECUTOR",F26:"EXECUTE_DENY",F27:"MUTATION_DENY",F28:"HANDSHAKE_DENY",F29:"ACCEPTANCE_DENY_QUARANTINE",F30:"SELECTION_DENY",F31:"CACHED_HANDOFF_REVALIDATION_DENY",F32:"INCIDENT_QUALIFICATION_FAIL",F33:"EXTERNAL_SOURCE_MUTATION_DENY",F34:"MINT_DENY_RESOURCE_CREATE_ZERO",F35:"AUTO_REATTEST_NO_PROJECT_RESET",F36:"WRONG_ATTEMPT_DENY",F37:"DEPENDENCY_JOIN_FAILURE_ISOLATION_PASS",F38:"RECEIPT_CHAIN_ACCEPTANCE_DENY"
});
export const V006_NEGATIVE_FIXTURE_IDS_V1=Object.freeze(Object.keys(V006_NEGATIVE_FIXTURE_EXPECTED_V1));
export function evaluateV006NegativeFixtureV1(id,input={}){
 let code=null;
 switch(id){
  case"F01":code=input.sourceHeadChanged?"STALE_HANDOFF_DENY":"UNTRIGGERED";break;
  case"F02":code=input.wrongProject||input.wrongTarget?"IDENTITY_FENCE_FAIL":"UNTRIGGERED";break;
  case"F03":code=input.executorSuccess&&input.targetStateUnchanged?"ACCEPTANCE_DENY":"UNTRIGGERED";break;
  case"F04":code=input.resumeSignal&&!input.mutationComplete?"AUTHORITATIVE_READBACK_PENDING":"UNTRIGGERED";break;
  case"F05":code=input.singleUseOutcome==="UNKNOWN"?"NO_REPLAY_RECONCILE":"UNTRIGGERED";break;
  case"F06":code=input.destructiveAcrossReadbackBoundary?"BATCH_COMPILER_SPLIT":"UNTRIGGERED";break;
  case"F07":code=input.cancelled&&input.lateCompletion?"LATE_RESULT_QUARANTINE":"UNTRIGGERED";break;
  case"F08":code=input.protocolStale||input.schemaStale?"HANDSHAKE_DENY":"UNTRIGGERED";break;
  case"F09":code=input.rawCredentialInCapsule?"SECURITY_FAIL":"UNTRIGGERED";break;
  case"F10":code=input.durableAuthWrongScope||input.durableAuthWrongTarget?"CREDENTIAL_ATTEST_FAIL":"UNTRIGGERED";break;
  case"F11":code=input.autoMintRequired&&input.legacyFallbackUsed?"LEGACY_FALLBACK_FAIL_CLOSED":"UNTRIGGERED";break;
  case"F12":code=input.shortLivedExpired?"AUTO_REMINT":"UNTRIGGERED";break;
  case"F13":code=input.tokenMintFailed?"PAID_RESOURCE_CREATE_ZERO":"UNTRIGGERED";break;
  case"F14":code=input.transportUnreachable?"PAID_RESOURCE_CREATE_ZERO":"UNTRIGGERED";break;
  case"F15":code=input.exitPathUnknown?"PAID_RESOURCE_CREATE_ZERO":"UNTRIGGERED";break;
  case"F16":code=input.partialCompletion?"RECONCILE_AND_RESUME_MISSING_ONLY":"UNTRIGGERED";break;
  case"F17":code=input.newChatDuringWait?"DURABLE_REATTACH_NO_DUPLICATE":"UNTRIGGERED";break;
  case"F18":code=input.supersededByNewerSourceOrPlan?"OLD_HANDOFF_REVOKED":"UNTRIGGERED";break;
  case"F19":code=input.unexpectedArtifact?"ARTIFACT_QUARANTINE_NO_ACCEPTANCE":"UNTRIGGERED";break;
  case"F20":code=input.manualStateMutation?"TRUST_RESET_REATTEST":"UNTRIGGERED";break;
  case"F21":code=input.twoExecutorsSameStateChangingHandoff?"ONE_ACTIVE_ACTUATOR":"UNTRIGGERED";break;
  case"F22":code=input.twoWritesSameTarget?"SERIALIZE_OR_CONFLICT_DENY":"UNTRIGGERED";break;
  case"F23":code=input.independentTargets?"SAFE_PARALLEL_PASS":"UNTRIGGERED";break;
  case"F24":code=input.executorCapabilityMismatch?"HANDOFF_DELIVERY_DENY":"UNTRIGGERED";break;
  case"F25":code=input.dataPolicyForbidsEgress?"HANDOFF_DENY_OR_ALTERNATE_EXECUTOR":"UNTRIGGERED";break;
  case"F26":code=input.payloadDigestTampered?"EXECUTE_DENY":"UNTRIGGERED";break;
  case"F27":code=input.preActuationTargetDrift?"MUTATION_DENY":"UNTRIGGERED";break;
  case"F28":code=input.oldExecutorProtocol?"HANDSHAKE_DENY":"UNTRIGGERED";break;
  case"F29":code=input.revokedOfflineThenLate?"ACCEPTANCE_DENY_QUARANTINE":"UNTRIGGERED";break;
  case"F30":code=input.zeroActionsProfile&&input.actionsSelected?"SELECTION_DENY":"UNTRIGGERED";break;
  case"F31":code=input.cachedHandoffWithoutRevalidation?"CACHED_HANDOFF_REVALIDATION_DENY":"UNTRIGGERED";break;
  case"F32":code=input.diagnosticsLostBeforeTeardown?"INCIDENT_QUALIFICATION_FAIL":"UNTRIGGERED";break;
  case"F33":code=input.externalSourceMutationWithoutCompiler?"EXTERNAL_SOURCE_MUTATION_DENY":"UNTRIGGERED";break;
  case"F34":code=input.durableAuthorityRevoked?"MINT_DENY_RESOURCE_CREATE_ZERO":"UNTRIGGERED";break;
  case"F35":code=input.durableAuthorityRotated?"AUTO_REATTEST_NO_PROJECT_RESET":"UNTRIGGERED";break;
  case"F36":code=input.validCredentialWrongAttempt?"WRONG_ATTEMPT_DENY":"UNTRIGGERED";break;
  case"F37":code=input.multipleIndependentHandoffs?"DEPENDENCY_JOIN_FAILURE_ISOLATION_PASS":"UNTRIGGERED";break;
  case"F38":code=input.receiptChainDigestBroken?"RECEIPT_CHAIN_ACCEPTANCE_DENY":"UNTRIGGERED";break;
  default:throw new Error("V006_FIXTURE_ID_UNKNOWN");
 }
 const expected=V006_NEGATIVE_FIXTURE_EXPECTED_V1[id];
 return Object.freeze({schemaId:"V006_NEGATIVE_FIXTURE_RECEIPT_V1",id,expectedCode:expected,observedCode:code,status:code===expected?"PASS":"FAIL"});
}
export function aggregateV006NegativeFixturesV1(receipts=[]){
 const byId=new Map(receipts.map(r=>[r?.id,r]));
 const missing=V006_NEGATIVE_FIXTURE_IDS_V1.filter(id=>!byId.has(id));
 const failed=V006_NEGATIVE_FIXTURE_IDS_V1.filter(id=>byId.get(id)?.status!=="PASS");
 return Object.freeze({schemaId:"V006_NEGATIVE_FIXTURE_MATRIX_RECEIPT_V1",requiredFixtureCount:38,observedFixtureCount:receipts.length,missing,failed,status:missing.length===0&&failed.length===0?"PASS":"FAIL"});
}
