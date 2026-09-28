// Supplemental QA only: explicit ?ch= shortcuts; never used for route completion.
import {chromium} from 'playwright';
import {base} from '../serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('../shots/codex-qa/',import.meta.url));
const mobile=process.argv.includes('--mobile'),prefix=mobile?'probe_mobile':'probe';
const r={events:[],errors:[],shortcuts:true};let browser,page,seq=0,last=Date.now();
const timer=setTimeout(()=>{fs.writeFileSync(path.join(out,prefix+'.json'),JSON.stringify(r,null,2));process.exit(2);},15*60*1000);
const vis=s=>page.locator(s).filter({visible:true});
async function snap(name){const f=`${prefix}_${String(++seq).padStart(2,'0')}_${name}.png`;await page.screenshot({path:path.join(out,f)});return f;}
async function record(type,data={}){const e={at:new Date().toISOString(),type,...data};r.events.push(e);console.log(JSON.stringify(e));fs.writeFileSync(path.join(out,prefix+'.json'),JSON.stringify(r,null,2));}
async function keyMove(dx,dy,ms){const keys=[dx<0?'ArrowLeft':dx>0?'ArrowRight':null,dy<0?'ArrowUp':dy>0?'ArrowDown':null].filter(Boolean);for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(ms);for(const k of keys)await page.keyboard.up(k);}
async function go(t){
 let stuck=Date.now(),prev=null;
 for(let i=0;i<180;i++){
  const s=await page.evaluate(()=>G.world.test.state());if(s.busy)return false;
  const near=await page.evaluate(()=>G.world.test.near());if(t.id&&near?.id===t.id)return true;
  if(prev&&Math.hypot(s.x-prev.x,s.y-prev.y)<2){if(Date.now()-stuck>5000){await record('stuck5',{state:s,target:t,shot:await snap('stuck')});return false;}}else stuck=Date.now();prev=s;
  const dest=await page.evaluate(t=>{const T=G.world.test,s=T.state(),m=T.map(),z=8,w=m.w*4,h=m.h*4,N=w*h,prev=new Int32Array(N).fill(-1),q=[],blocked=new Uint8Array(N);for(let y=1;y<h;y++)for(let x=1;x<w;x++)blocked[y*w+x]=T.blocked(x*z-6,y*z-5,x*z+6,y*z)?1:0;const start=Math.round(s.y/z)*w+Math.round(s.x/z);prev[start]=start;q.push(start);let end=-1;for(let a=0;a<q.length;a++){const p=q[a],x=p%w,y=Math.floor(p/w);if(Math.hypot(x*z-t.x,(y*z-t.y)*(t.id?1.3:1))<(t.id?25:10)){end=p;break;}for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy,j=Y*w+X;if(X<1||Y<1||X>=w-1||Y>=h-1||prev[j]>=0||blocked[j])continue;prev[j]=p;q.push(j);}}if(end<0)return null;const list=[];for(let p=end;p!==start;p=prev[p])list.push([p%w*z,Math.floor(p/w)*z]);list.reverse();return list[Math.min(3,list.length-1)]||[t.x,t.y];},t);
  if(!dest)return false;if(!t.id&&Math.hypot(s.x-t.x,s.y-t.y)<12)return true;
  await keyMove(dest[0]-s.x,dest[1]-s.y,Math.min(430,Math.hypot(dest[0]-s.x,dest[1]-s.y)/92*1000));
 }
 return false;
}
async function advanceUntilRoam(max=35){for(let i=0;i<max;i++){if(!(await page.evaluate(()=>G.world.test.state().busy)))return;const b=vis('.dlg-tray .primary');if(await b.count())await b.first().click();else break;await page.waitForTimeout(100);} }
async function layouts(label){for(const [w,h]of [[390,844],[844,390],[768,1024],[1366,800]]){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(200);const bounds=await page.evaluate(()=>{const selectors=['.hud','.goal','.pad','.pbtn.talk','.pbtn.atk','.dlg-box','.dlg-tray','.hand','.sheet'];return{viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],elements:selectors.flatMap(sel=>[...document.querySelectorAll(sel)].filter(e=>e.getClientRects().length).map(e=>{const a=e.getBoundingClientRect();return{sel,x:a.x,y:a.y,w:a.width,h:a.height,scrollH:e.scrollHeight,clientH:e.clientHeight};}))};});await record('layout',{label,size:[w,h],bounds,shot:await snap(label+'_'+w)});} }
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const ctx=await browser.newContext({viewport:{width:1366,height:800},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1});
 await ctx.route('**/*',async x=>{const u=new URL(x.request().url());if(['file:','data:','blob:'].includes(u.protocol)||['127.0.0.1','localhost'].includes(u.hostname))await x.continue();else await x.abort();});
 page=await ctx.newPage();page.setDefaultTimeout(5000);
 page.on('console',m=>{if(['error','warning'].includes(m.type()))r.errors.push({url:page.url(),kind:m.type(),text:m.text()});});page.on('pageerror',e=>r.errors.push({url:page.url(),kind:'pageerror',text:e.message}));page.on('response',x=>{if(x.status()>=400)r.errors.push({url:x.url(),kind:'http',status:x.status()});});
 await page.goto(new URL('../../index.html',import.meta.url).href);await page.waitForTimeout(500);await record('file_title',{title:await page.locator('body').innerText(),shot:await snap('file_title')});
 await vis('button:has-text("이야기 시작")').click();await vis('.sheet button:has-text("처음 배우기")').click();await page.waitForTimeout(500);await advanceUntilRoam();
 const narrator=await page.evaluate(()=>G.world.test.targets()[0]);await go(narrator);await page.keyboard.press('e');
 let universal=false;for(let i=0;i<25;i++){if(!universal&&(await page.locator('body').innerText()).includes('누구나 일곱')){universal=true;await record('universal_seven',{text:await page.locator('body').innerText(),shot:await snap('universal_seven')});}if(await vis('.opt.big').count())await vis('.opt.big').first().click();else if(await vis('.dlg-tray .primary').count())await vis('.dlg-tray .primary').first().click();else break;await page.waitForTimeout(130);}
 const before=await page.evaluate(()=>G.save.state);await page.reload();await vis('button:has-text("이어 하기")').click();await page.waitForTimeout(500);await record('file_resume',{before,after:await page.evaluate(()=>({state:G.save.state,world:G.world.test.state()})),shot:await snap('file_resume')});
 const BASE=await base();await page.goto(BASE+'?ch=ch1');await page.waitForTimeout(500);await advanceUntilRoam();
 await layouts('world');await page.setViewportSize({width:1366,height:800});
 const npc=await page.evaluate(()=>G.world.test.npcs().find(n=>n.id==='c1'));await go(npc);await page.keyboard.press('e');await page.waitForTimeout(150);const beforeSpam=await page.locator('body').innerText();for(let i=0;i<20;i++)await page.keyboard.press('e');await record('dialog_e_spam',{before:beforeSpam,after:await page.locator('body').innerText(),world:await page.evaluate(()=>G.world.test.state()),shot:await snap('dialog_e_spam')});
 await layouts('dialog');await page.setViewportSize({width:1366,height:800});await vis('.dlg-tray .primary').click();await page.keyboard.press('e');await record('immediate_e',{world:await page.evaluate(()=>G.world.test.state()),shot:await snap('immediate_e')});
 await page.waitForTimeout(350);await page.keyboard.press('e');await page.waitForTimeout(120);await record('delayed_e',{world:await page.evaluate(()=>G.world.test.state()),shot:await snap('delayed_e')});const spamBtn=vis('.dlg-tray .primary');if(await spamBtn.count()){const b=await spamBtn.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2,{clickCount:8,delay:10});await record('dialog_click_spam',{world:await page.evaluate(()=>G.world.test.state()),text:await page.locator('body').innerText(),shot:await snap('dialog_click_spam')});}await advanceUntilRoam();
 // Push against outer wall, then retreat using real movement.
 const reached=await go({x:40,y:600});await keyMove(-1,0,3000);const wallBefore=await page.evaluate(()=>G.world.test.state());await keyMove(-1,0,1200);await record('wall_collision',{reached,before:wallBefore,after:await page.evaluate(()=>G.world.test.state()),shot:await snap('wall_collision')});await keyMove(1,0,350);
 await page.goto(BASE+'?ch=ch7');await page.waitForTimeout(500);await advanceUntilRoam(45);await layouts('combat');await page.setViewportSize({width:1366,height:800});
 for(const name of ['목차','편람','설정']){await page.locator(`button[aria-label="${name}"]`).click();const a=await page.evaluate(()=>G.world.test.state());await page.waitForTimeout(1200);const b=await page.evaluate(()=>G.world.test.state());await record('combat_pause',{name,before:a,after:b,shot:await snap('combat_pause_'+seq)});if(await vis('.sheet-back').count())await vis('.sheet .actions button').last().click();else await page.locator('.overlay button[aria-label="닫기"]').click();}
 await record('done',{errors:r.errors.length});
}catch(e){await record('failure',{message:e.message,stack:e.stack,shot:page?await snap('failure').catch(()=>null):null});}
finally{clearTimeout(timer);await browser?.close();fs.writeFileSync(path.join(out,prefix+'.json'),JSON.stringify(r,null,2));}
