const PROVIDERS = new Set(['LOCAL', 'VMWARE', 'DIGITALOCEAN']);
const TRANSPORTS = new Set(['DIRECT_WORKER', 'GITHUB_SELF_HOSTED_JIT']);

export function compileExecutionBindingV1({ providerClass, transportClass, verifierPolicyRef } = {}) {
  if (!PROVIDERS.has(providerClass)) throw new Error('COMPUTE_PROVIDER_UNSUPPORTED');
  if (!TRANSPORTS.has(transportClass)) throw new Error('EXECUTION_TRANSPORT_UNSUPPORTED');
  if (typeof verifierPolicyRef !== 'string' || !verifierPolicyRef) throw new Error('VERIFIER_POLICY_REF_REQUIRED');
  const valid = new Set(['LOCAL:DIRECT_WORKER','VMWARE:DIRECT_WORKER','DIGITALOCEAN:DIRECT_WORKER','VMWARE:GITHUB_SELF_HOSTED_JIT','DIGITALOCEAN:GITHUB_SELF_HOSTED_JIT']);
  if (!valid.has(`${providerClass}:${transportClass}`)) throw new Error('PROVIDER_TRANSPORT_COMBINATION_UNSUPPORTED');
  return Object.freeze({ schemaId: 'EXECUTION_BINDING_V1', providerClass, transportClass, verifierPolicyRef, computeProviderEqualsTransport: false, transportEqualsVerifierPolicy: false });
}
