import fs from 'node:fs';
const out=new URL('../shots/codex-qa/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,out),'utf8'));
for(const route of ['m','fa','fb','fc']){
 const r=read(`run_${route}.json`), pending=new Map(),nav=[];
 for(const e of r.events){if(e.type==='navigate')pending.set(e.map+':'+e.target.id,e);if(e.type==='arrived'){const a=pending.get(e.map+':'+e.target);if(a){nav.push({target:e.target,map:e.map,seconds:+(e.t-a.t).toFixed(2),explore:e.explore});pending.delete(e.map+':'+e.target);}}}
 const png=fs.readFileSync(new URL(`result_${route}.png`,out));
 console.log(JSON.stringify({route,complete:r.complete,last:r.events.at(-1),dimensions:[png.readUInt32BE(16),png.readUInt32BE(20)],navLongest:nav.sort((a,b)=>b.seconds-a.seconds).slice(0,5),dodges:r.events.filter(e=>e.type==='dodge').length,stuck:r.events.filter(e=>e.type==='stuck5').length}));
}
const c=read('coverage.json');console.log(JSON.stringify({coverage:{visited:c.visited,total:c.total,missing:c.missing.length,npcs:c.rows.filter(r=>r.type==='npc').length},texts:c.texts}));
