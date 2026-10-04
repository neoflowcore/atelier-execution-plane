function strings(values, code) {
  if (!Array.isArray(values) || values.length === 0 || values.some((v) => typeof v !== 'string' || !v)) throw new Error(code);
  return [...new Set(values)];
}
function intersection(a, b) { const bset = new Set(b); return a.filter((v) => bset.has(v)); }

export function negotiateExecutionProtocolV1({ runtime, worker } = {}) {
  if (!runtime || !worker) throw new Error('PROTOCOL_PEERS_REQUIRED');
  const dimensions = [
    ['contractSetDigest', strings(runtime.contractSetDigests, 'RUNTIME_CONTRACT_SET_REQUIRED'), strings(worker.contractSetDigests, 'WORKER_CONTRACT_SET_REQUIRED')],
    ['workerAgentProtocolVersion', strings(runtime.workerAgentProtocolVersions, 'RUNTIME_WORKER_PROTOCOL_REQUIRED'), strings(worker.workerAgentProtocolVersions, 'WORKER_PROTOCOL_REQUIRED')],
    ['bootstrapBundleVersion', strings(runtime.bootstrapBundleVersions, 'RUNTIME_BOOTSTRAP_VERSION_REQUIRED'), strings(worker.bootstrapBundleVersions, 'WORKER_BOOTSTRAP_VERSION_REQUIRED')],
    ['providerAdapterVersion', strings(runtime.providerAdapterVersions, 'RUNTIME_PROVIDER_ADAPTER_VERSION_REQUIRED'), strings(worker.providerAdapterVersions, 'WORKER_PROVIDER_ADAPTER_VERSION_REQUIRED')],
    ['executionTransportVersion', strings(runtime.executionTransportVersions, 'RUNTIME_TRANSPORT_VERSION_REQUIRED'), strings(worker.executionTransportVersions, 'WORKER_TRANSPORT_VERSION_REQUIRED')],
    ['receiptSchemaVersion', strings(runtime.receiptSchemaVersions, 'RUNTIME_RECEIPT_SCHEMA_REQUIRED'), strings(worker.receiptSchemaVersions, 'WORKER_RECEIPT_SCHEMA_REQUIRED')]
  ];
  const selected = {};
  for (const [name, left, right] of dimensions) {
    const common = intersection(left, right);
    if (common.length === 0) return Object.freeze({ allowed: false, code: 'NO_COMMON_PROTOCOL', failedDimension: name, selected: null, silentDowngrade: false });
    selected[name] = common[0];
  }
  return Object.freeze({ allowed: true, code: 'PROTOCOL_NEGOTIATED', selected: Object.freeze(selected), silentDowngrade: false });
}
