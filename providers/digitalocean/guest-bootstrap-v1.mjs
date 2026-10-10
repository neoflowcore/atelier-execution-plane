import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const publicKey=/^ssh-ed25519 [A-Za-z0-9+/]+={0,2}(?: [a-zA-Z0-9_.@-]+)?$/;

// Ephemeral SSH host material stays in this closure. Only materialize it for
// the authenticated provider create request; never place it in diff receipts.
// Access-key expiry does not terminate compute or stop provider billing.
export function createDigitalOceanGuestBootstrapV1(input={}){
  const {executionId,leaseId,sourceSha,planSha256,clientPublicKey,hostPublicKey,hostPrivateKey,ttlSeconds,nowMs=Date.now()}=input;
  if(!/^[a-zA-Z0-9_-]{1,60}$/.test(executionId??'')||!/^[a-zA-Z0-9_-]{1,60}$/.test(leaseId??'')||!/^[0-9a-f]{40}$/.test(sourceSha??'')||!/^[0-9a-f]{64}$/.test(planSha256??''))throw Error('DO_GUEST_IDENTITY_REQUIRED');
  if(!Number.isSafeInteger(ttlSeconds)||ttlSeconds<1||ttlSeconds>1800||!Number.isSafeInteger(nowMs)||nowMs<0)throw Error('DO_GUEST_LEASE_REQUIRED');
  const begin=['-----BEGIN','OPENSSH','PRIVATE KEY-----'].join(' '),end=['-----END','OPENSSH','PRIVATE KEY-----'].join(' ');
  if(!publicKey.test(clientPublicKey??'')||!publicKey.test(hostPublicKey??'')||typeof hostPrivateKey!=='string'||!hostPrivateKey.startsWith(begin+'\n')||!hostPrivateKey.trimEnd().endsWith(end))throw Error('DO_GUEST_EPHEMERAL_KEYS_REQUIRED');
  const expiresAtMs=nowMs+ttlSeconds*1000;
  const expiry=new Date(expiresAtMs).toISOString().replace(/[-:]/g,'').replace('T','').slice(0,14)+'Z';
  const authorized=`expiry-time="${expiry}",no-agent-forwarding,no-port-forwarding,no-X11-forwarding,no-pty ${clientPublicKey}`;
  let userData='#cloud-config\n'+JSON.stringify({
    disable_root:true,ssh_pwauth:false,allow_public_ssh_keys:false,ssh_deletekeys:true,ssh_quiet_keygen:true,
    ssh_keys:{ed25519_private:hostPrivateKey,ed25519_public:hostPublicKey},
    users:[{name:'atelier',lock_passwd:true,sudo:false,shell:'/bin/bash',ssh_authorized_keys:[authorized]}],
    write_files:[{path:'/etc/atelier-bootstrap',permissions:'0644',content:JSON.stringify({executionId,leaseId,sourceSha,planSha256,expiresAtMs})}]
  })+'\n';
  const metadata=Object.freeze({schemaId:'DO_EPHEMERAL_GUEST_BOOTSTRAP_V1',executionId,leaseId,sourceSha,planSha256,ttlSeconds,expiresAtMs,sshUser:'atelier',hostPublicKey,userDataSha256:hash(userData),providerCredentialOnGuest:false,computeTtlEnforcedByBootstrap:false,providerCleanupRequired:true});
  return Object.freeze({metadata,materializeUserData({nowMs=Date.now()}={}){
    if(userData===null)throw Error('DO_GUEST_BOOTSTRAP_REVOKED');
    if(!Number.isSafeInteger(nowMs)||nowMs<0||nowMs>=expiresAtMs)throw Error('DO_GUEST_BOOTSTRAP_EXPIRED');
    return userData;
  },revoke(){userData=null;}});
}
