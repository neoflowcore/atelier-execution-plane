export function evaluateGithubControllerIsolationV1({repository,sourceSha,controllerRun,peerRun,controllerJob,peerJob}={}){
  const runs=[controllerRun,peerRun];
  const checks={
    sourceBinding:/^[0-9a-f]{40}$/.test(sourceSha??'')&&runs.every(r=>r?.head_sha===sourceSha),
    repositoryBinding:repository==='neoflowcore/atelier-execution-plane'&&runs.every(r=>r?.repository?.full_name===repository&&r.event==='pull_request'&&r.head_branch==='ep52-h1-recovery'),
    distinctWorkflows:Number.isSafeInteger(controllerRun?.workflow_id)&&Number.isSafeInteger(peerRun?.workflow_id)&&controllerRun.workflow_id!==peerRun.workflow_id&&controllerRun.path?.split('@')[0]==='.github/workflows/r6-watchdog.yml'&&peerRun.path?.split('@')[0]==='.github/workflows/verify.yml',
    distinctRuns:Number.isSafeInteger(controllerRun?.id)&&Number.isSafeInteger(peerRun?.id)&&controllerRun.id!==peerRun.id,
    distinctRunners:Number.isSafeInteger(controllerJob?.runner_id)&&controllerJob.runner_id>0&&Number.isSafeInteger(peerJob?.runner_id)&&peerJob.runner_id>0&&controllerJob.runner_id!==peerJob.runner_id,
    jobBinding:controllerJob?.run_id===controllerRun?.id&&peerJob?.run_id===peerRun?.id&&controllerJob?.name==='r6_independent_watchdog'&&peerJob?.name==='verify',
    controllerRunning:controllerJob?.status==='in_progress',
    peerCompleted:peerJob?.status==='completed'&&peerJob?.conclusion==='success'
  };
  return Object.freeze({schemaId:'EP52_GITHUB_CONTROLLER_ISOLATION_V1',status:Object.values(checks).every(Boolean)?'SEPARATE_RUNNER_REFERENCE_PASS':'PENDING',checks,controllerRunId:controllerRun?.id??null,peerRunId:peerRun?.id??null,sourceSha:sourceSha??null,providerHostLossSurvivalAttested:false,platformOutageSurvivalAttested:false,paidCreateAuthorized:false,finalR6Acceptance:false});
}
