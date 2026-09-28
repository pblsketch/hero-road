import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=path.join(root,'tests/shots/codex-qa/integrity.json');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name),r=path.relative(root,f).replaceAll('\\','/');if(/^(tests\/(node_modules|shots|codex-qa)|design\/qa)(\/|$)/.test(r))return[];return e.isDirectory()?walk(f):[{file:r,sha256:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}];});}
const now=walk(root);
if(process.argv.includes('--check')){const old=JSON.parse(fs.readFileSync(output,'utf8'));const changed=old.filter(x=>now.find(y=>y.file===x.file)?.sha256!==x.sha256);console.log(JSON.stringify({files:old.length,changed}));}else{fs.writeFileSync(output,JSON.stringify(now,null,2));console.log('Baseline '+now.length+' files');}
