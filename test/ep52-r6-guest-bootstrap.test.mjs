import test from 'node:test';
import assert from 'node:assert/strict';
import {createDigitalOceanGuestBootstrapV1} from '../providers/digitalocean/guest-bootstrap-v1.mjs';
const privateKey=['-----BEGIN','OPENSSH','PRIVATE KEY-----'].join(' ')+'\nfixture-host-material\n'+['-----END','OPENSSH','PRIVATE KEY-----'].join(' ')+'\n';
const input={executionId:'exec',leaseId:'lease',sourceSha:'a'.repeat(40),planSha256:'b'.repeat(64),clientPublicKey:'ssh-ed25519 AAAA fixture-client',hostPublicKey:'ssh-ed25519 BBBB fixture-host',hostPrivateKey:privateKey,ttlSeconds:1800,nowMs:1000};
test('guest bootstrap keeps private host material out of serializable receipts',()=>{
  const b=createDigitalOceanGuestBootstrapV1(input);
  const json=JSON.stringify(b);assert.equal(json.includes('fixture-host-material'),false);
  const config=JSON.parse(b.materializeUserData({nowMs:1000}).split('\n').slice(1).join('\n'));
  assert.equal(config.ssh_keys.ed25519_private,privateKey);assert.equal(config.disable_root,true);assert.equal(config.ssh_pwauth,false);
  assert.equal(config.users[0].sudo,false);assert.match(config.users[0].ssh_authorized_keys[0],/expiry-time=.*no-port-forwarding/);
  assert.equal(b.metadata.computeTtlEnforcedByBootstrap,false);assert.equal(b.metadata.providerCleanupRequired,true);
});
test('expired revoked or malformed bootstrap cannot be materialized',()=>{
  const b=createDigitalOceanGuestBootstrapV1(input);
  assert.throws(()=>b.materializeUserData({nowMs:1801000}),/EXPIRED/);
  b.revoke();assert.throws(()=>b.materializeUserData({nowMs:1000}),/REVOKED/);
  for(const patch of [{ttlSeconds:1801},{leaseId:'bad\nkey'},{clientPublicKey:'ssh-ed25519 AAAA\ncommand'},{hostPrivateKey:'invalid'}])assert.throws(()=>createDigitalOceanGuestBootstrapV1({...input,...patch}),/LEASE_REQUIRED|IDENTITY_REQUIRED|EPHEMERAL_KEYS_REQUIRED/);
});
