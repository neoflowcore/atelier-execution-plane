const AGENTS=new Set(["codex","opencode","claude-code"]);
const SIZES=new Set(["mars-1vcpu-1gb","mars-2vcpu-2gb","mars-2vcpu-4gb","mars-4vcpu-8gb","mars-16vcpu-32gb"]);
function req(v,code){if(typeof v!=="string"||!v)throw new Error(code);return v;}
function uniq(values=[]){return [...new Set(values)];}

export function compileDigitalOceanHarnessEnvironmentV1(input={}){
  const agent=input.agent??"codex";
  if(!AGENTS.has(agent))throw new Error("HARNESS_AGENT_UNSUPPORTED");
  const size=input.size??"mars-2vcpu-4gb";
  if(!SIZES.has(size))throw new Error("HARNESS_SIZE_UNSUPPORTED");
  const model=req(input.model??"openai-gpt-5.3-codex","HARNESS_INFERENCE_MODEL_REQUIRED");
  const repo=req(input.repository,"HARNESS_REPOSITORY_REQUIRED");
  const idleTimeout=input.idleTimeout??"10m";
  if(!/^\d+(?:h\d+m|h|m|s)$/.test(idleTimeout))throw new Error("HARNESS_IDLE_TIMEOUT_INVALID");

  const allowHosts=uniq(input.allowHosts??[
    "github.com",
    "api.github.com",
    "objects.githubusercontent.com",
    "registry.npmjs.org"
  ]);

  const environment=Object.freeze({
    schemaId:"EP52_V006_DIGITALOCEAN_HARNESS_ENVIRONMENT_V1",
    name:req(input.name??"ep52-v006-reference","HARNESS_NAME_REQUIRED"),
    agent,
    size,
    idle_timeout:idleTimeout,
    repos:[repo],
    env:Object.freeze({
      HARNESS_INFERENCE_MODEL:model
    }),
    secrets:Object.freeze({
      HARNESS_INFERENCE_API_KEY:"${HARNESS_INFERENCE_API_KEY}"
    }),
    egress:Object.freeze({allow_hosts:allowHosts}),
    permissions:Object.freeze({default:"allow"}),
    billing:Object.freeze({
      preferredFundingOrder:[
        "AGENT_DROPLETS_SUBSCRIPTION_BALANCE",
        "PROMOTIONAL_CREDITS",
        "INFERENCE_AND_AGENTS_BALANCE",
        "ACCOUNT_PREPAYMENT_BALANCE"
      ],
      rawDropletFallback:false
    }),
    security:Object.freeze({
      rawSecretInSource:false,
      rawSecretInChat:false,
      resolvedManifestPersistAllowed:false,
      sessionRemoveRequired:true,
      finalResidueReadbackRequired:true
    })
  });
  return environment;
}

export function compileHarnessRuntimeCreateInvocationV1({environment,prompt,onHitl="approve"}={}){
  if(!environment||environment.schemaId!=="EP52_V006_DIGITALOCEAN_HARNESS_ENVIRONMENT_V1")throw new Error("HARNESS_ENVIRONMENT_REQUIRED");
  req(prompt,"HARNESS_PROMPT_REQUIRED");
  if(!["approve","reject","defer"].includes(onHitl))throw new Error("HARNESS_HITL_POLICY_INVALID");
  return Object.freeze({
    schemaId:"EP52_V006_HARNESS_CREATE_INVOCATION_V1",
    executable:"doctl",
    argv:Object.freeze([
      "harness-runtime","create",
      "--spec","-",
      "--prompt",prompt,
      "--on-hitl",onHitl,
      "--interactive=false",
      "-o","json"
    ]),
    manifestDelivery:"STDIN",
    secretDelivery:"SERVER_SIDE_SECRET_SLOT_OR_STDIN_REFERENCE",
    rawSecretInArgv:false,
    resumeOnTopoff:false,
    spendingConsentExpanded:false
  });
}

export function evaluateHarnessRuntimeSurfaceV1(input={}){
  const checks={
    officialHarnessRuntimeAvailable:input.officialHarnessRuntimeAvailable===true,
    currentConnectedSurfaceCanCreateSession:input.currentConnectedSurfaceCanCreateSession===true,
    targetIdentityReadback:input.targetIdentityReadback==="PASS",
    balanceGate:input.balanceGate==="PASS",
    sourceIdentityBound:input.sourceIdentityBound==="PASS",
    cleanupCapability:input.cleanupCapability==="PASS"
  };
  const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
  return Object.freeze({
    schemaId:"EP52_V006_HARNESS_SURFACE_READINESS_V1",
    checks,
    failures,
    ready:failures.length===0,
    status:failures.length===0?"READY_FOR_R1_HARNESS_LIVE_REFERENCE":"DEFERRED_HARNESS_SURFACE_REATTACH",
    rawDropletFallbackAllowed:false,
    browserControlFallbackAllowed:false
  });
}

export function projectHarnessRuntimeToV006ReferencesV1(input={}){
  const pass=v=>v==="PASS"||v===true;
  const R1=pass(input.exactHandoff)&&pass(input.capabilityAttestation)&&pass(input.protocolHandshake)&&pass(input.externalEffect)&&pass(input.postconditionReadback)&&pass(input.reconcile)&&pass(input.sameRunResume)&&pass(input.cleanup)?"PASS":"PENDING";
  const R4=pass(input.partialCompletionReconcileResume)?"PASS":"PENDING";
  const R5=pass(input.disconnectReattach)&&pass(input.durableSessionIdentity)&&pass(input.noDuplicateExecution)?"PASS":"PENDING";
  const R6=pass(input.paidResourceAuthPreflight)&&pass(input.balanceGate)&&pass(input.cleanupPreflight)&&pass(input.costEnvelopeBound)?"PASS":"PENDING";
  return Object.freeze({
    schemaId:"EP52_V006_HARNESS_REFERENCE_PROJECTION_V1",
    provider:"DIGITALOCEAN_HARNESS_RUNTIME",
    R1,R4,R5,R6,
    VMWARE_REQUIRED:false,
    predecessorVmwareMatrixRetroactivelyPromoted:false,
    runtimeAcceptanceAuthority:"RUNTIME",
    executorSelfAcceptance:false
  });
}

export {AGENTS as HARNESS_AGENT_ADAPTERS,SIZES as HARNESS_SANDBOX_SIZES};
