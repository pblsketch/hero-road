import {chromium} from 'playwright';
import {base} from '../serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('../shots/codex-qa/',import.meta.url));
const result={shortcut:'?ch=ch5 (supplementary terrain QA)',events:[]};let browser,page,n=0;
const timer=setTimeout(()=>process.exit(2),180000);
async function move(key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}
async function snap(name){const shot=`terrain_${++n}_${name}.png`;await page.screenshot({path:path.join(out,shot)});const world=await page.evaluate(()=>G.world.test.state());result.events.push({name,world,shot});console.log(name,JSON.stringify(world));}
try{
 browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1366,height:800}});page.setDefaultTimeout(10000);
 await page.goto((await base())+'?ch=ch5');await page.waitForTimeout(500);
 for(let i=0;i<40;i++){const b=page.locator('.dlg-tray button.primary').filter({visible:true});if(await b.count()){await b.click();await page.waitForTimeout(120);}else if(!(await page.evaluate(()=>G.world.test.state().busy)))break;else await page.waitForTimeout(150);}
 await snap('river_start');await move('ArrowUp',1100);await snap('water_contact');await move('ArrowUp',1200);await snap('water_still');await move('ArrowDown',450);await snap('water_escape');
 // Willow base is x358..378, y264..288; stand behind and in front via real inputs.
 const x=await page.evaluate(()=>G.world.test.state().x);await move('ArrowRight',Math.max(0,(368-x)/84*1000));await snap('willow_back');await move('ArrowDown',1200);await snap('willow_collision');await move('ArrowRight',650);await move('ArrowDown',750);await move('ArrowLeft',650);await snap('willow_front');await move('ArrowUp',1100);await snap('willow_front_contact');await move('ArrowRight',700);await snap('willow_escape');
 result.complete=true;
}catch(e){result.error=e.stack;}
finally{clearTimeout(timer);fs.writeFileSync(path.join(out,'terrain.json'),JSON.stringify(result,null,2));await browser?.close();}
