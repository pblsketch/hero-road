// Local screenshot contact sheet, not modified game imagery.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const out=fileURLToPath(new URL('../shots/codex-qa/',import.meta.url));
const timer=setTimeout(()=>process.exit(2),90000),events=[];
for(const r of ['fa','fc','m','fb']){const f=path.join(out,`run_${r}.json`);if(fs.existsSync(f))events.push(...JSON.parse(fs.readFileSync(f,'utf8')).events);}
const chosen=[];for(const map of ['market','palace','hometown','mountain','river','hermitage','camp','field','siege','inlaw']){const e=events.find(e=>e.state?.map===map&&e.shot&&e.type==='goal');if(e)chosen.push({map,file:e.shot});}
const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#ece9df;font:16px sans-serif;display:grid;grid-template-columns:repeat(2,1fr);gap:10px}figure{margin:0;background:white;padding:10px}img{width:100%;height:400px;object-fit:contain}figcaption{padding:5px}</style>${chosen.map(x=>`<figure><figcaption>${x.map} — ${x.file}</figcaption><img src="${x.file}"></figure>`).join('')}`;
const f=path.join(out,'gallery.html');fs.writeFileSync(f,html);
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1500,height:950}});await p.goto(pathToFileURL(f).href);await p.screenshot({path:path.join(out,'gallery.png'),fullPage:true});await b.close();clearTimeout(timer);console.log(chosen);
