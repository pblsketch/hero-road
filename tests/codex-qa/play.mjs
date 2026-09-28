// Actual-input QA. No game mutation, teleport or teacher mode. Chapter shortcuts only in explicit supplemental probes.
import { chromium } from 'playwright';
import { base } from '../serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const route = process.argv[2] || 'm';
const CARD_PROBE=process.argv.includes('--card-probe'),LESSON_PROBE=process.argv.includes('--lesson-probe'),DODGE_PROBE=process.argv.includes('--dodge-probe'),PROBE=CARD_PROBE||LESSON_PROBE||DODGE_PROBE;
const mobile = route === 'm' || route === 'fb' || PROBE;
const ri = ['m','fa','fb','fc'].indexOf(route);
const out = fileURLToPath(new URL(CARD_PROBE?'../shots/codex-qa/card_probe/':LESSON_PROBE?'../shots/codex-qa/lesson_probe/':DODGE_PROBE?'../shots/codex-qa/dodge_probe/':'../shots/codex-qa/', import.meta.url));
fs.mkdirSync(out,{recursive:true});
const report = { route, started:new Date().toISOString(), events:[], errors:[], shots:[], complete:false };
const start = Date.now();
let browser, page, cdp, seq=0, lastProgress=Date.now(), lastSig='', navLast=null, stuckAt=Date.now(), activeTarget='', exploreTarget=null;
let reloadLesson=false,reloadTrain=false,wrongOnce=false, pauseTest=false, combatShot='', lastRed=0, tutorialTurns=0, tutorialDefended=false,probeLayouts=false;
const explored=new Set(), goalSeen=new Set(), battleSeen=new Set();
const log=(type,data={})=>{const e={t:+((Date.now()-start)/1000).toFixed(2),type,...data};report.events.push(e);console.log(JSON.stringify(e));};
const save=()=>fs.writeFileSync(path.join(out,`run_${route}.json`),JSON.stringify(report,null,2));
const deadline=setTimeout(async()=>{log('timeout');save();await browser?.close();process.exit(2);},55*60*1000);
const vis=s=>page.locator(s).filter({visible:true});
async function shot(name){const f=`${route}_${String(++seq).padStart(3,'0')}_${name.replace(/[^a-zA-Z0-9_-]/g,'_')}.png`;await page.screenshot({path:path.join(out,f)});report.shots.push(f);return f;}
async function click(loc){await loc.scrollIntoViewIfNeeded();if(mobile) await loc.tap({timeout:20000});else {await loc.focus();await page.keyboard.press('Enter');}lastProgress=Date.now();}
async function button(s){await click(vis(s).first());}
async function move(dx,dy,ms){
 if(!dx&&!dy)return;
 if(mobile){const b=await page.locator('.joy-zone').boundingBox();const x=Math.max(65,b.x+b.width*.45),y=Math.min(b.y+b.height*.65,720);const d=Math.hypot(dx,dy);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+44*dx/d,y:y+44*dy/d,id:1}]});await page.waitForTimeout(ms);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else{const keys=[dx<-1?'ArrowLeft':dx>1?'ArrowRight':null,dy<-1?'ArrowUp':dy>1?'ArrowDown':null].filter(Boolean);for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(ms);for(const k of keys)await page.keyboard.up(k);}
}
async function action(key){if(mobile){const s={e:'.pbtn.talk',Space:'.pbtn.atk',q:'.pbtn.skill'}[key];if(await vis(s).count())await vis(s).tap({timeout:15000});}else await page.keyboard.press(key);}
async function flushTexts(){const data=await page.evaluate(()=>({texts:window.__qaTexts||[],samples:window.__qaSamples||[],fps:window.__qaFPS||[]}));report.texts=(report.texts||[]).concat(data.texts);report.samples=(report.samples||[]).concat(data.samples);report.fps=(report.fps||[]).concat(data.fps);await page.evaluate(()=>{window.__qaTexts=[];window.__qaSamples=[];window.__qaFPS=[];});fs.writeFileSync(path.join(out,`texts_${route}.json`),JSON.stringify(report.texts,null,2));save();}
async function reload(label){await flushTexts();const before=await page.evaluate(()=>G.save.state);await shot(label+'_before');await page.reload();await button('button:has-text("이어 하기")');await page.waitForTimeout(500);log('reload',{label,before,after:await page.evaluate(()=>({save:G.save.state,world:G.world.test.state()})),shot:await shot(label+'_after')});}
async function nav(target){
 const s=await page.evaluate(()=>G.world.test.state());
 if(s.busy)return;
 const near=await page.evaluate(()=>G.world.test.near());
 if(near?.id===target.id && !target.zone && target.kind!=='hit'){
  log('arrived',{target:target.id,map:s.map,x:s.x,y:s.y,explore:!!exploreTarget,shot:await shot('at_'+s.map+'_'+target.id)});
  await page.waitForTimeout(300);await action('e');await page.waitForTimeout(120);if(exploreTarget){const world=await page.evaluate(()=>G.world.test.state());log('exploration_dialogue',{target:exploreTarget,world,text:await page.locator('body').innerText(),shot:await shot('talk_'+s.map+'_'+target.id)});if(world.busy||exploreTarget.kind==='spot'){explored.add(exploreTarget.key);exploreTarget=null;}}activeTarget='';return;
 }
 const dest=await page.evaluate(t=>{
  const S=G.world.test.state(),m=G.world.test.map(),T=G.world.test; const step=8,w=Math.ceil(m.w*32/step),h=Math.ceil(m.h*32/step),N=w*h;
  const idx=(x,y)=>y*w+x,px=i=>(i%w)*step,py=i=>Math.floor(i/w)*step;
  const blocked=new Uint8Array(N);for(let y=1;y<h;y++)for(let x=1;x<w;x++)blocked[idx(x,y)]=T.blocked(x*step-6,y*step-5,x*step+6,y*step)?1:0;
  const sx=Math.round(S.x/step),sy=Math.round(S.y/step),si=idx(sx,sy),prev=new Int32Array(N).fill(-1),q=new Int32Array(N);let a=0,b=0;q[b++]=si;prev[si]=si;
  const close=(x,y)=>t.zone?x>t.rect[0]+2&&x<t.rect[0]+t.rect[2]-2&&y>t.rect[1]+2&&y<t.rect[1]+t.rect[3]-2:t.kind==='spot'?x>t.rect[0]-10&&x<t.rect[0]+t.rect[2]+10&&y>t.rect[1]-10&&y<t.rect[1]+t.rect[3]+14:t.kind==='hit'?Math.hypot(x-t.x,y-t.y)<25:Math.hypot(x-t.x,(y-t.y)*1.3)<27;
  let end=-1;while(a<b){const p=q[a++],x=p%w,y=Math.floor(p/w);if(close(x*step,y*step)){end=p;break;}for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const X=x+dx,Y=y+dy,j=idx(X,Y);if(X<1||Y<1||X>=w-1||Y>=h-1||prev[j]>=0||blocked[j]||dx&&dy&&(blocked[idx(x+dx,y)]||blocked[idx(x,y+dy)]))continue;prev[j]=p;q[b++]=j;}}
  if(end<0)return{fail:true,visited:b};let list=[];for(let p=end;p!==si;p=prev[p])list.push([px(p),py(p)]);list.reverse();if(!list.length)return{x:t.x,y:t.y,close:true};let k=0;const dx=list[0][0]-sx*step,dy=list[0][1]-sy*step;while(k+1<list.length&&k<4&&list[k+1][0]-list[k][0]===dx&&list[k+1][1]-list[k][1]===dy)k++;return{x:list[k][0],y:list[k][1],length:list.length};
 },target);
 const key=s.map+':'+target.id;
 if(activeTarget!==key){activeTarget=key;navLast={x:s.x,y:s.y};stuckAt=Date.now();log('navigate',{target,map:s.map,x:s.x,y:s.y});}
 if(Math.hypot(s.x-navLast.x,s.y-navLast.y)>5){navLast={x:s.x,y:s.y};stuckAt=Date.now();}
 if(Date.now()-stuckAt>5000){log('stuck5',{target,state:s,dest,shot:await shot('stuck_'+target.id)});stuckAt=Date.now();await move(ri%2?1:-1,1,440);if(dest.fail&&exploreTarget){explored.add(exploreTarget.key);exploreTarget=null;}return;}
 if(dest.fail){await page.waitForTimeout(450);return;}
 if(dest.close&&target.kind==='hit'){await move(target.x-s.x,target.y-20-s.y,50);await action('Space');await page.waitForTimeout(340);return;}
 const dx=dest.x-s.x,dy=dest.y-s.y;await move(dx,dy,Math.min(440,Math.max(35,Math.hypot(dx,dy)/92*1000)));
}
async function pickExplore(s){
 if(s.enemies||s.escaping)return null;
 const candidates=await page.evaluate(()=>{const S=G.world.test.state(),ch=G.world.chId,m=MAPS[S.map],goal=S.goal?.targets||[],cs=QUESTS[ch]?.cast?.[S.map]||{};return [...G.world.test.npcs().filter(n=>n.talk&&!goal.includes(n.id)).flatMap(n=>{const d=m.npcs?.[n.id]||cs[n.id];return Array.from({length:d?.talk?.length||1},(_,i)=>({...n,kind:'npc',variant:i}));}),...Object.entries(m.spots||{}).filter(([id,d])=>(d.look||d.hint)&&!goal.includes(id)).map(([id,d])=>({id,kind:'spot',x:(d.x+d.w/2)*32,y:(d.y+d.h/2)*32,rect:[d.x*32,d.y*32,d.w*32,d.h*32],variant:0}))].map(n=>({...n,key:S.map+':'+(S.map==='hometown'?ch+':':'')+n.id+':'+n.variant}));});
 return candidates.find(n=>!explored.has(n.key));
}
async function combat(s){
 if(DODGE_PROBE&&report.dodgeValidated&&!report.heavenValidated){const heaven=await page.evaluate(()=>G.save.state.heaven);if(!heaven){await page.waitForTimeout(200);return;}report.heavenValidated=true;log('heaven_resumed',{heaven,state:s});}
 const key=s.map+':'+s.goal?.text;
 if(combatShot!==key){combatShot=key;log('action_start',{state:s,shot:await shot('combat_'+s.map)});}
 if(!pauseTest&&s.enemies&&route==='m'){
  pauseTest=true;for(const name of ['목차','편람','설정']){await page.locator(`button[aria-label="${name}"]`).tap();const a=await page.evaluate(()=>G.world.test.state());await page.waitForTimeout(1100);const b=await page.evaluate(()=>G.world.test.state());log('pause_test',{name,before:a,after:b,shot:await shot('pause_'+name)});if(await vis('.sheet-back').count())await click(vis('.sheet .actions button').last());else await button('.overlay button[aria-label="닫기"]');}
 }
 const f=s.foes.reduce((a,b)=>Math.hypot(b[0]-s.x,b[1]-s.y)<Math.hypot(a[0]-s.x,a[1]-s.y)?b:a);
 const dx=f[0]-s.x,dy=f[1]-s.y,d=Math.hypot(dx,dy);
 // Read rendered canvas pixels for bright red telegraph, not enemy internals.
 const red=await page.evaluate(()=>{const c=document.querySelector('.wcv'),g=c.getContext('2d'),a=g.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<a.length;i+=64)if(a[i]>215&&a[i+1]>35&&a[i+1]<110&&a[i+2]<90)n++;return n;});
 if(DODGE_PROBE&&!report.dodgeValidated){
  if(d>29){await move(dx,dy,Math.min(200,(d-25)/92*1000));return;}
  if(red>12){log('deliberate_dodge',{red,before:s});await move(-dx,-dy,450);log('deliberate_dodge_after',{state:await page.evaluate(()=>G.world.test.state()),shot:await shot('mobile_dodge')});report.dodgeValidated=true;return;}
  await page.waitForTimeout(70);return;
 }
 if(d<45&&red>12&&Date.now()-lastRed>800){lastRed=Date.now();log('dodge',{red,d,x:s.x,y:s.y});await move(-dx,-dy,330);return;}
 if(d>33)await move(dx,dy,Math.min(250,(d-28)/92*1000));else await move(dx,dy,35);
 await action('Space');if(s.foes.some(e=>Math.hypot(e[0]-s.x,e[1]-s.y)<80))await action('q');await page.waitForTimeout(110);
}
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:800},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1,acceptDownloads:true});
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:','file:'].includes(u.protocol))await r.continue();else {log('external_blocked',{url:u.href});await r.abort();}});
 await ctx.addInitScript(()=>{
  window.__qaTexts=[];window.__qaSamples=[];window.__qaFPS=[];let last='',lastState='',frame;
  const scan=()=>{if(!document.body)return;const t=document.body.innerText;if(t!==last){last=t;window.__qaTexts.push({at:Date.now(),ch:window.G?.world?.chId,world:window.G?.world?.test?.state(),text:t});}};
  addEventListener('DOMContentLoaded',()=>{new MutationObserver(scan).observe(document.body,{subtree:true,childList:true,characterData:true});scan();});
  setInterval(()=>{if(window.G?.world?.test){const w=G.world.test.state(),s=G.save.state;const x={at:Date.now(),ch:G.world.chId,...w,heaven:s.heaven,doubt:s.doubt,doubtMax:s.doubtMax,abil:{...s.abil},done:Object.keys(s.done),cardHP:document.querySelector('.fighter.hero .hpnum')?.textContent,enemy:document.querySelector('.fighter.foe .nm')?.textContent};const sig=JSON.stringify(x);if(sig!==lastState){window.__qaSamples.push(x);lastState=sig;}}},100);
  function tick(t){if(frame&&window.G?.world?.test){const w=G.world.test.state();if(w.enemies&&!w.busy)window.__qaFPS.push(t-frame);}frame=t;requestAnimationFrame(tick);}requestAnimationFrame(tick);
 });
 page=await ctx.newPage();page.setDefaultTimeout(20000);cdp=await ctx.newCDPSession(page);
 for(const kind of ['console','pageerror','requestfailed','response'])page.on(kind,v=>{let msg;if(kind==='console'&&['error','warning'].includes(v.type()))msg=v.type()+': '+v.text();if(kind==='pageerror')msg=v.message;if(kind==='requestfailed')msg=v.url()+' '+v.failure()?.errorText;if(kind==='response'&&v.status()>=400)msg=v.status()+' '+v.url();if(msg){report.errors.push({t:Date.now()-start,kind,msg});console.log('ERROR '+msg);}});
 const BASE=await base();await page.goto(BASE);await page.evaluate(()=>localStorage.clear());await page.reload();await shot('title');if(CARD_PROBE||DODGE_PROBE){log('supplemental_shortcut',{chapter:DODGE_PROBE?'ch7':'ch5',path:DODGE_PROBE?'m':'f'});await page.goto(BASE+(DODGE_PROBE?'?path=m&ch=ch7':'?path=f&ch=ch5'));}else{await button('button:has-text("이야기 시작")');await button(`.sheet button:has-text("${route==='fa'?'깊이 읽기':'처음 배우기'}")`);}
 let loops=0,lastFlush=Date.now();
 while(++loops<30000){
  await page.waitForTimeout(65);
  if(Date.now()-lastFlush>20000){await flushTexts();lastFlush=Date.now();}
  const s=await page.evaluate(()=>({w:G.world.test.state(),save:G.save.state,ch:G.world.chId,text:document.body.innerText}));
  const sig=JSON.stringify([s.ch,s.w.goal,Object.keys(s.save.done),s.w.enemies,s.text]);if(sig!==lastSig){lastProgress=Date.now();lastSig=sig;}
  if(Date.now()-lastProgress>90000){log('no_progress',{state:s.w,shot:await shot('no_progress')});throw Error('90 seconds without progress');}
  if(await vis('.bookcover').count())break;
  if(PROBE&&report.tutorialValidated){report.probeComplete=true;break;}
  if(DODGE_PROBE&&report.dodgeValidated&&s.save.done['b:b7-2']){report.probeComplete=true;log('dodge_probe_complete',{state:s.w,save:s.save});break;}
  if(LESSON_PROBE&&reloadLesson&&s.ch==='ch5'){report.lessonValidated=true;report.probeComplete=true;log('lesson_validated',{state:s.w,save:s.save,shot:await shot('lesson_validated')});break;}
  if(await vis('.sheet-back').count()){log('sheet',{text:await vis('.sheet-back').innerText(),shot:await shot('sheet')});await click(vis('.sheet .actions button').last());continue;}
  if(route==='m'&&!reloadLesson&&/1차시[은는] 여기까지/.test(s.text)){reloadLesson=true;await reload('lesson_end');continue;}
  if(route==='m'&&!reloadTrain&&s.w.goal?.text?.includes('수련 2/')){reloadTrain=true;await reload('training_mid');continue;}
  if(s.w.goal&&!s.w.busy){
   if(!goalSeen.has(s.ch+':'+s.w.map+':'+s.w.goal.text)){goalSeen.add(s.ch+':'+s.w.map+':'+s.w.goal.text);log('goal',{ch:s.ch,state:s.w,save:s.save,shot:await shot('goal_'+s.ch+'_'+s.w.map)});}
   if(s.w.enemies&&!s.w.escaping){await combat(s.w);continue;}
   if(!LESSON_PROBE&&(exploreTarget|| (exploreTarget=await pickExplore(s.w)))){const fresh=await page.evaluate(id=>G.world.test.npcs().find(n=>n.id===id),exploreTarget.id);await nav({...exploreTarget,...fresh});continue;}
   const ts=await page.evaluate(()=>G.world.test.targets());if(ts.length){let index=ri%ts.length;if(s.w.goal.text.startsWith('수련')){const round=Number(s.w.goal.text.match(/수련 (\d)/)?.[1]||1);const combos=[[0,1,2],[1,2,1],[2,0,0],[2,2,1]];index=combos[ri][round-1]%ts.length;}await nav(ts[index]);continue;}
  }
  if(await vis('input.name-input.sur').count()){await vis('input.name-input.sur').fill(['홍','김','이','박'][ri]);await vis('input.name-input:not(.sur)').fill(['대웅','가람','소화','하늘'][ri]);await button('.dlg-tray button.primary');continue;}
  if(await vis('input[placeholder="남장 이름"]').count()){await vis('input[placeholder="남장 이름"]').fill(ri===1?'평국':'청운');await button('.dlg-tray button.primary');continue;}
  if(await vis('.hand .bcard').count()){
   if(PROBE&&!probeLayouts){probeLayouts=true;for(const [width,height]of [[390,844],[844,390],[768,1024],[1366,800]]){await page.setViewportSize({width,height});await page.waitForTimeout(250);log('card_layout',{width,height,shot:await shot('card_layout_'+width),bounds:await page.evaluate(()=>[...document.querySelectorAll('.battle,.intent,.hand,.dlg-scroll,.dlg-tray')].map(e=>{const r=e.getBoundingClientRect();return{cls:e.className,x:r.x,y:r.y,w:r.width,h:r.height,scrollH:e.scrollHeight,clientH:e.clientHeight};}))});}await page.setViewportSize({width:390,height:844});}
   const intent=await vis('.intent').textContent(), cards=await vis('.hand .bcard').allTextContents(),enemy=await vis('.fighter.foe .nm').textContent();
   const key=s.ch+enemy;if(!battleSeen.has(key)){battleSeen.add(key);log('card_start',{ch:s.ch,enemy,shot:await shot('card_'+s.ch)});}
   const score=cards.map(t=>{let n=Number(t.match(/피해 (\d+)/)?.[1]||0);if(/강공|요술|기를 모음/.test(intent)&&/계책|천서/.test(t))n+=25;if(/강공/.test(intent)&&/둔갑|신갑|진법/.test(t))n+=15;if(/풍운/.test(t))n+=4;return n;});let i=score.indexOf(Math.max(...score));
   if(route==='fc'&&s.ch==='ch5'&&tutorialTurns<4){tutorialTurns++;const defensive=cards.findIndex(t=>/진법|둔갑술/.test(t));if(/기를 모음/.test(intent)&&defensive>=0){i=defensive;tutorialDefended=true;log('tutorial_defend_charge',{intent,card:cards[i],shot:await shot('tutorial_defend_charge')});}else if(tutorialTurns<3){const passive=cards.findIndex(t=>/부적|진법|둔갑술/.test(t));if(passive>=0)i=passive;else i=cards.findIndex(t=>/칼 휘두르기/.test(t));if(i<0)i=0;}else if(/강공/.test(intent)&&tutorialDefended){const attack=cards.findIndex(t=>/칼 휘두르기|일기당천|신검/.test(t));if(attack>=0)i=attack;log('tutorial_next_heavy',{intent,hero:await vis('.fighter.hero').innerText(),shot:await shot('tutorial_next_heavy')});}}
   if(PROBE){const defensive=cards.findIndex(t=>/진법|둔갑술/.test(t)),passive=cards.findIndex(t=>/부적|진법|둔갑술/.test(t));if(/기를 모음/.test(intent)&&defensive>=0){i=defensive;tutorialDefended=true;log('tutorial_defend_charge',{intent,card:cards[i],shot:await shot('tutorial_defend_charge')});}else if(/강공/.test(intent)&&tutorialDefended){i=cards.findIndex(t=>/부적|칼 휘두르기/.test(t));if(i<0)i=0;log('tutorial_next_heavy',{intent,hero:await vis('.fighter.hero').innerText(),shot:await shot('tutorial_next_heavy')});report.tutorialValidated=true;}else if(passive>=0)i=passive;else{i=cards.findIndex(t=>/칼 휘두르기/.test(t));if(i<0)i=0;}}
   log('card',{ch:s.ch,enemy,intent,card:cards[i],hp:await vis('.fighter.hero .hpnum').textContent()});await click(vis('.hand .bcard').nth(i));await page.waitForTimeout(1100);if(route==='fc'&&s.ch==='ch5'&&tutorialDefended)await shot('tutorial_after_'+tutorialTurns);continue;
  }
  if(await vis('.opt.passage:not([disabled])').count()){
   const right=await page.evaluate(()=>{const ch=STORY.find(c=>c.id===G.world.chId),st=G.save.state;const id=st.path==='m'?'yuchungnyeol':'honggyewol';return Object.values(WORKS).flatMap(w=>w.stages[ch.stage]?[w.stages[ch.stage].t.replace(/\*\*/g,'')]:[]);});
   const opts=vis('.opt.passage:not([disabled])'),texts=await opts.allTextContents();let i=texts.findIndex(t=>right.some(r=>t.trim()===r.trim()));if(i<0)i=0;if(!wrongOnce){wrongOnce=true;const j=texts.findIndex((_,j)=>j!==i);await click(opts.nth(j));log('intentional_wrong',{ch:s.ch,shot:await shot('wrong')});continue;}await click(opts.nth(i));continue;
  }
  if(await vis('.stage-btn:not([disabled])').count()){
   const n=await page.evaluate(()=>{const t=document.querySelector('.card.work p').textContent;return PASSAGES.find(p=>t.includes(p.t.replace(/\*\*/g,'').slice(0,14)))?.stage;});if(n)await click(vis('.stage-btn').nth(n-1));else await click(vis('.stage-btn:not([disabled])').first());continue;
  }
  if(await vis('.pool .pcard').count()){
   const mine=Object.values(s.save.myStage);for(const t of mine){const cards=vis('.pool .pcard');const texts=await cards.allTextContents();const i=texts.findIndex(x=>x.trim()===t.trim());if(i>=0)await click(cards.nth(i));}await button('button:has-text("맞추어 보기")');log('order',{shot:await shot('order')});continue;
  }
  if(await vis('.opt:not([disabled])').count()){
   const opts=vis('.opt:not([disabled])'),texts=await opts.allTextContents();let i=ri%texts.length;
   if(texts.some(t=>t.startsWith('아들')))i=route==='m'?0:1;
   if(texts.some(t=>t.includes('남장을 한다')))i=texts.findIndex(t=>t.includes(route==='fc'?'남장하지 않는다':'남장을 한다'));
   if(texts.some(t=>t.includes('계속 활약한다')))i=texts.findIndex(t=>t.includes(route==='fb'?'규방으로 돌아간다':'계속 활약한다'));
   log('choice',{ch:s.ch,options:texts,pick:i,text:texts[i]});await click(opts.nth(Math.max(0,i)));continue;
  }
  const primary=vis('.dlg-tray button.primary, .tray button.primary');if(await primary.count()){await click(primary.first());continue;}
 }
 if(PROBE){await flushTexts();log('probe_complete',{validated:report.tutorialValidated||report.lessonValidated});}else{
 if(!await vis('.bookcover').count())throw Error('Loop limit');
 await vis('input.name-input.wide').fill('QA 학생 '+route);
 for(const ta of await vis('textarea.reflect').all())await ta.fill('위기를 이겨 내는 과정은 같지만, 사회가 허용한 활동과 결말은 달랐다.');
 await shot('result');await vis('.branchmap').scrollIntoViewIfNeeded();await shot('branchmap');
 const dl=page.waitForEvent('download',{timeout:10000});await button('button:has-text("이미지로 저장")');const download=await dl;await download.saveAs(path.join(out,`result_${route}.png`));log('download',{file:`result_${route}.png`,suggested:download.suggestedFilename()});
 await button('button[aria-label="편람"]');for(const tab of ['일대기 7단계','작품 도감','관습 사전','헷갈리기 쉬운 것','실제와 설정']){await click(vis('.overlay .tab').filter({hasText:tab}));await page.waitForTimeout(100);await shot('book_'+tab);} 
 report.complete=true;report.final=await page.evaluate(()=>G.save.state);log('complete',{heaven:report.final.heaven,doubtMax:report.final.doubtMax,branch:report.final.branch});await flushTexts();
 }
}catch(e){report.failure=e.stack;log('failure',{error:e.message});if(page){try{await shot('FAILURE');await flushTexts();}catch{}}save();}
finally{clearTimeout(deadline);save();await browser?.close();}
