import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGithubControllerIsolationV1} from '../watchdog/teardown-watchdog/github-isolation-v1.mjs';
function input(){
  const repository='neoflowcore/atelier-execution-plane',sourceSha='a'.repeat(40),common={head_sha:sourceSha,repository:{full_name:repository},event:'pull_request',head_branch:'ep52-h1-recovery'};
  return {repository,sourceSha,controllerRun:{...common,id:1,workflow_id:10,path:'.github/workflows/r6-watchdog.yml'},peerRun:{...common,id:2,workflow_id:20,path:'.github/workflows/verify.yml'},controllerJob:{run_id:1,name:'r6_independent_watchdog',runner_id:101,status:'in_progress'},peerJob:{run_id:2,name:'verify',runner_id:202,status:'completed',conclusion:'success'}};
}
test('distinct source-bound workflow runs and runners are a scoped reference, not provider cleanup authority',()=>{
  const r=evaluateGithubControllerIsolationV1(input());assert.equal(r.status,'SEPARATE_RUNNER_REFERENCE_PASS');assert.equal(r.paidCreateAuthorized,false);assert.equal(r.providerHostLossSurvivalAttested,false);assert.equal(r.finalR6Acceptance,false);
});
test('same runner, same workflow, foreign repo/source, mismatched job and uncompleted peer reject isolation',()=>{
  const mutations=[x=>{x.peerJob.runner_id=101;},x=>{x.peerRun.workflow_id=10;},x=>{x.peerRun.repository={full_name:'foreign/repo'};},x=>{x.peerRun.head_sha='b'.repeat(40);},x=>{x.peerJob.run_id=1;},x=>{x.peerJob.status='in_progress';},x=>{delete x.controllerJob.runner_id;}];
  for(const mutate of mutations){const x=input();mutate(x);assert.equal(evaluateGithubControllerIsolationV1(x).status,'PENDING');}
});
