import hashlib,json,pathlib,re,subprocess,zipfile
root=pathlib.Path(__file__).resolve().parent.parent
plugin=root/'plugins/cloudflare-runtime-power'
out=root/'artifacts/ep52/runtime-power-plugin'
manifest=json.loads((plugin/'plugin.json').read_text())
mcp=json.loads((plugin/'mcp.json').read_text())
if manifest.get('name')!='cloudflare-runtime-power' or manifest.get('version')!='0.1.0':
 raise ValueError('POWER_PACKAGE_IDENTITY')
server=mcp.get('mcpServers',{}).get('cloudflare',{})
if server.get('url')!='https://mcp.cloudflare.com/mcp' or server.get('extensions',{}).get('com.openai',{}).get('auth',{}).get('type')!='oauth':
 raise ValueError('POWER_PACKAGE_OFFICIAL_OAUTH')
files=sorted(p for p in plugin.rglob('*') if p.is_file())
required=['plugin.json','mcp.json','skills/cloudflare-runtime-power/SKILL.md','skills/cloudflare-runtime-power/agents/openai.yaml','skills/cloudflare-runtime-power/scripts/runtime-power-v1.mjs','skills/cloudflare-runtime-power/scripts/build-mcp-code.mjs']
if [p.relative_to(plugin).as_posix() for p in files]!=sorted(required):
 raise ValueError('POWER_PACKAGE_FILE_SET')
module=(plugin/'skills/cloudflare-runtime-power/scripts/runtime-power-v1.mjs').read_bytes()
if module!=(root/'power/cloudflare/runtime-power-v1.mjs').read_bytes():
 raise ValueError('POWER_PACKAGE_MODULE_DRIFT')
digests={}
for p in files:
 if p.is_symlink(): raise ValueError('POWER_PACKAGE_SYMLINK')
 data=p.read_bytes()
 text=data.decode('utf8')
 if re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|Bearer [A-Za-z0-9_-]{20,}',text):
  raise ValueError('POWER_PACKAGE_CREDENTIAL')
 digests[p.relative_to(plugin).as_posix()]=hashlib.sha256(data).hexdigest()
out.mkdir(parents=True,exist_ok=True)
archive=out/'cloudflare-runtime-power-0.1.0.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for p in files:
  info=zipfile.ZipInfo(p.relative_to(plugin).as_posix(),(2026,10,15,0,0,0))
  info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,p.read_bytes())
try:
 source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True,stderr=subprocess.DEVNULL).strip()
except subprocess.CalledProcessError: source=None
receipt={'schemaId':'CLOUDFLARE_RUNTIME_POWER_PACKAGE_V1','version':'0.1.0','sourceSha':source,'files':digests,'zipSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'scope':'PERSONAL_INSTALLATION_CANDIDATE','installed':False,'publiclyPublished':False,'credentialValuesIncluded':False}
(out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'status':'PACKAGE_VALID','fileCount':len(files),'sourceSha':source,'zipSha256':receipt['zipSha256']}))

