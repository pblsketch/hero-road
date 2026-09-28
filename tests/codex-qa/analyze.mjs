import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('../shots/codex-qa/',import.meta.url));
const all=[];
for(const route of ['m','fa','fb','fc']){
 const fn=path.join(out,`run_${route}.json`);if(!fs.existsSync(fn))continue;
 const r=JSON.parse(fs.readFileSync(fn,'utf8')),samples=r.samples||[],chapters=[];
 for(const ch of ['ch0','ch1','ch2','ch3','ch4','ch5','ch6','ch7']){const rows=samples.filter(s=>s.ch===ch);if(rows.length)chapters.push({ch,seconds:Math.round((rows.at(-1).at-rows[0].at)/1000),heavenEnd:rows.at(-1).heaven,maxDoubt:Math.max(...rows.map(s=>s.doubtMax||0))});}
 const fights=[];let current=null;
 for(const s of samples){const goal=s.goal?.text?.replace(/ \(\d+\/\d+\)$/,'');const key=goal&&/물리쳐라|막아라/.test(goal)&&!s.escaping?`${s.ch}/${s.map}/${goal}`:null;if(key&&(!current||current.key!==key)){if(current)fights.push(current);current={key,start:s.at,end:s.at,hpStart:s.hp,hpEnd:s.hp,damage:0,heavenStart:s.heaven,heavenEnd:s.heaven,prevHP:s.hp};}if(current){if(s.hp<current.prevHP)current.damage+=current.prevHP-s.hp;current.prevHP=s.hp;current.end=s.at;current.hpEnd=s.hp;current.heavenEnd=s.heaven;if(!key){fights.push(current);current=null;}}}if(current)fights.push(current);
 const cards=[];current=null;
 for(const s of samples){const key=s.enemy?`${s.ch}/${s.enemy}`:null;const hp=Number(s.cardHP?.match(/기력 (\d+)/)?.[1]);if(key&&(!current||current.key!==key)){if(current)cards.push(current);current={key,start:s.at,end:s.at,damage:0,prevHP:hp,heavenStart:s.heaven,heavenEnd:s.heaven};}if(current){if(Number.isFinite(hp)){if(hp<current.prevHP)current.damage+=current.prevHP-hp;current.prevHP=hp;}current.end=s.at;current.heavenEnd=s.heaven;if(!key){cards.push(current);current=null;}}}if(current)cards.push(current);
 const fps=(r.fps||[]).filter(x=>x>0).sort((a,b)=>a-b),sum=fps.reduce((a,b)=>a+b,0);
 const merged=[];for(const f of fights){const old=merged.find(x=>x.key===f.key);if(old){old.end=f.end;old.hpEnd=f.hpEnd;old.damage+=f.damage;old.heavenEnd=f.heavenEnd;}else merged.push({...f});}
 const entry={route,complete:r.complete,failure:r.failure,chapters,action:merged.map(x=>({...x,seconds:+((x.end-x.start)/1000).toFixed(1),heaven:x.heavenEnd-x.heavenStart})),cards:cards.map(x=>({...x,seconds:+((x.end-x.start)/1000).toFixed(1),heaven:x.heavenEnd-x.heavenStart})),fps:{samples:fps.length,meanMs:sum/fps.length,fps:1000*fps.length/sum,p95:fps[Math.floor(fps.length*.95)],over50:fps.filter(x=>x>50).length},final:r.final,errors:r.errors,stuck:r.events.filter(e=>/stuck|failure|reload/.test(e.type)),goals:r.events.filter(e=>e.type==='goal').map(e=>({t:e.t,ch:e.ch,map:e.state.map,goal:e.state.goal.text})),choices:r.events.filter(e=>e.type==='choice')};
 all.push(entry);
 const lines=new Set();for(const s of r.texts||[])for(const l of s.text.split('\n'))if(l.trim())lines.add(l.trim());fs.writeFileSync(path.join(out,`review_${route}.txt`),[...lines].join('\n'));
 console.log(JSON.stringify({route,complete:entry.complete,ch:chapters.at(-1),action:entry.action.map(x=>({key:x.key,seconds:x.seconds,damage:x.damage})),cards:entry.cards.map(x=>({key:x.key,seconds:x.seconds,damage:x.damage})),fps:entry.fps,errors:r.errors.length,stuck:entry.stuck.length}));
}
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(all,null,2));
