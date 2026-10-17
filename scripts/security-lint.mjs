import { readdir, readFile } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';
const root = new URL('../', import.meta.url); const rootPath = root.pathname;
const forbiddenNames = new Set(['.env', '.env.local', 'id_rsa', 'id_ed25519', 'credentials.json']);
const contentRules = [['PRIVATE_KEY', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['GITHUB_CLASSIC_PAT', /\bghp_[A-Za-z0-9]{30,}\b/],['GITHUB_FINE_GRAINED_PAT', /\bgithub_pat_[A-Za-z0-9_]{30,}\b/],['AWS_ACCESS_KEY', /\bAKIA[0-9A-Z]{16}\b/]];
const violations=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.name==='.git'||entry.name==='node_modules')continue;const full=join(dir,entry.name);const rel=relative(rootPath,full).replaceAll('\\','/');if(entry.isDirectory()){await walk(full);continue;}if(forbiddenNames.has(basename(full)))violations.push({path:rel,code:'FORBIDDEN_SECRET_FILENAME'});const bytes=await readFile(full);if(bytes.includes(0))continue;const text=bytes.toString('utf8');for(const [code,regex] of contentRules)if(regex.test(text))violations.push({path:rel,code});}}
await walk(rootPath); if(violations.length){console.error(JSON.stringify({schema:'EP52_SECURITY_LINT_V1',status:'FAIL',violations},null,2));process.exitCode=1;}else console.log(JSON.stringify({schema:'EP52_SECURITY_LINT_V1',status:'PASS',violations:[]},null,2));
