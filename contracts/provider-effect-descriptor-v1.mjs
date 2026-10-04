const EFFECTS = new Set(['PURE_READ', 'QUERY', 'SOURCE_MUTATION', 'PROVIDER_MUTATION', 'DESTRUCTIVE_MUTATION']);
const TRANSPORT_METHODS = new Set(['LOCAL_CALL', 'HTTP', 'SDK', 'CLI']);
const NON_MUTATING = new Set(['PURE_READ', 'QUERY']);
function reqString(value, code) { if (typeof value !== 'string' || value.length === 0) throw new Error(code); return value; }
function uniqueStrings(values, code) { if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || !value)) throw new Error(code); return [...new Set(values)].sort(); }
export function compileProviderEffectDescriptorV1(input = {}) {
  const effectClass = reqString(input.effectClass, 'EFFECT_CLASS_REQUIRED');
  if (!EFFECTS.has(effectClass)) throw new Error('UNKNOWN_EFFECT_CLASS');
  const transportMethod = reqString(input.transportMethod, 'TRANSPORT_METHOD_REQUIRED');
  if (!TRANSPORT_METHODS.has(transportMethod)) throw new Error('TRANSPORT_METHOD_UNSUPPORTED');
  const providerMutation = input.providerMutation === true, sourceMutation = input.sourceMutation === true, destructive = input.destructive === true;
  if (NON_MUTATING.has(effectClass) && (providerMutation || sourceMutation || destructive)) throw new Error('READ_EFFECT_MUTATION_MISMATCH');
  if (effectClass === 'SOURCE_MUTATION' && (!sourceMutation || providerMutation || destructive)) throw new Error('SOURCE_MUTATION_EFFECT_MISMATCH');
  if (effectClass === 'PROVIDER_MUTATION' && (!providerMutation || sourceMutation || destructive)) throw new Error('PROVIDER_MUTATION_EFFECT_MISMATCH');
  if (effectClass === 'DESTRUCTIVE_MUTATION' && (!providerMutation || !destructive || sourceMutation)) throw new Error('DESTRUCTIVE_MUTATION_EFFECT_MISMATCH');
  return Object.freeze({schemaId:'PROVIDER_EFFECT_DESCRIPTOR_V1',operation:reqString(input.operation,'OPERATION_REQUIRED'),transportMethod,effectClass,providerMutation,sourceMutation,destructive,requiredCredentialCapability:input.requiredCredentialCapability??null,schemaContractVersion:reqString(input.schemaContractVersion??'1','SCHEMA_CONTRACT_VERSION_REQUIRED'),requiredIdentityFields:uniqueStrings(input.requiredIdentityFields??[],'REQUIRED_IDENTITY_FIELDS_INVALID')});
}
export function assertProviderResponseSchemaV1({ descriptor, response, requiredFields = [], knownEnumFields = {} } = {}) {
  if (!descriptor || descriptor.schemaId !== 'PROVIDER_EFFECT_DESCRIPTOR_V1') throw new Error('PROVIDER_EFFECT_DESCRIPTOR_REQUIRED');
  if (!response || typeof response !== 'object' || Array.isArray(response)) return Object.freeze({ ok: false, code: 'BLOCKED_SCHEMA_DRIFT', errors: ['PROVIDER_RESPONSE_OBJECT_REQUIRED'] });
  const errors=[]; for (const field of requiredFields) if (!(field in response)) errors.push(`MISSING_REQUIRED_FIELD:${field}`);
  for (const [field,allowed] of Object.entries(knownEnumFields)) if (field in response && !allowed.includes(response[field])) errors.push(`UNKNOWN_ENUM:${field}:${String(response[field])}`);
  return Object.freeze({ ok: errors.length===0, code: errors.length?'BLOCKED_SCHEMA_DRIFT':'SCHEMA_CONTRACT_PASS', errors });
}
