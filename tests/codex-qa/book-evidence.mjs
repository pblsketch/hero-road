import {chromium} from 'playwright';import {base} from '../serve.mjs';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
const out=new URL('../shots/codex-qa/',import.meta.url);let browser;
const timer=setTimeout(()=>process.exit(2),120000);
try{browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1366,height:800}});page.setDefaultTimeout(10000);
await page.route('**/*',async r=>{const u=new URL(r.request().url());if(['localhost','127.0.0.1'].includes(u.hostname)||['data:','blob:'].includes(u.protocol))await r.continue();else await r.abort();});
await page.goto(await base());await page.getByRole('button',{name:'이야기 시작',exact:true}).click();await page.getByRole('button',{name:'처음 배우기',exact:false}).click();await page.getByRole('button',{name:'편람',exact:true}).click();
await page.getByText('영웅의 일대기(영웅의 일생) 7단계는',{exact:false}).scrollIntoViewIfNeeded();await page.screenshot({path:fileURLToPath(new URL('book_seven_exception.png',out))});fs.writeFileSync(new URL('book_seven_exception.json',out),JSON.stringify({text:await page.locator('body').innerText(),shortcuts:false},null,2));
}finally{clearTimeout(timer);await browser?.close();}
