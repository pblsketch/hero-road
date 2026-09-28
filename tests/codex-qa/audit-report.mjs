import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=path.join(root,'tests/shots/codex-qa'),md=fs.readFileSync(path.join(root,'design/qa/QA_보고서_codex.md'),'utf8');
const read=n=>JSON.parse(fs.readFileSync(path.join(out,n),'utf8'));
const refs=[...new Set([...md.matchAll(/`([^`\n]+\.png)`/g)].map(x=>x[1]))];
const missing=refs.filter(n=>!fs.existsSync(path.join(out,n))&&!fs.existsSync(path.join(out,'lesson_probe',n)));
const summaries=read('summary.json');
for(const s of summaries){const r=read(`run_${s.route}.json`);console.log(JSON.stringify({route:s.route,complete:r.complete,chapters:s.chapters.map(x=>x.seconds),battles:[s.action.map(x=>[x.key,x.seconds,x.damage]),s.cards.map(x=>[x.key,x.seconds,x.damage])],choices:r.final.flags,dodges:r.events.filter(x=>x.type==='dodge').length}));if(!r.complete)throw Error('Incomplete '+s.route);}
console.log(JSON.stringify({imageReferences:refs.length,missing,issues:[...md.matchAll(/^\| QA-00\d \| (높음|중간|낮음)/gm)].length,lesson:read('lesson_probe/run_m.json').lessonValidated,training:read('run_m.json').events.filter(x=>x.shot==='m_106_goal_ch5_hermitage.png').map(x=>x.state),cardProbe:read('card_probe/run_fc.json').tutorialValidated}));
if(missing.length||md.includes('\uFFFD'))process.exitCode=1;
