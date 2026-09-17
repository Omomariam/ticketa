import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:5173');
 await page.getByRole('heading',{name:'Event tickets. In your wallet.'}).waitFor();
 assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'),'/favicon.svg');
 assert.equal((await page.request.get(new URL('/favicon.svg',page.url()).href)).status(),200);
 assert.equal(await page.locator('footer a[href="https://botchain.ai"]').count(),1);
 assert.equal(await page.locator('footer a[href="https://scan.botchain.ai"]').count(),1);
 await page.locator('.landing-copy').getByRole('button',{name:'Connect wallet',exact:true}).click();
 await page.getByRole('dialog',{name:'Connect wallet'}).waitFor();
 await page.getByText('No wallet was found in this browser.',{exact:false}).waitFor();
 assert.equal(await page.locator('.sidebar').count(),0);
 await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('dialog').count(),0);
 for(const path of ['/app','/app/tickets','/app/transfers','/app/organizer','/app/organizer/create','/app/check-in','/app/account','/app/help','/app/events/1']){
  await page.goto((process.env.APP_URL||'http://127.0.0.1:5173')+'/#'+path);
  await page.getByRole('heading',{name:'Connect your wallet to continue.'}).waitFor();
  assert.equal(await page.locator('.sidebar').count(),0,'App access must require a real wallet');
 }
 await page.goto(process.env.APP_URL||'http://127.0.0.1:5173');
 fs.mkdirSync('artifacts',{recursive:true});
 await page.screenshot({path:'artifacts/landing-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'artifacts/landing-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.setViewportSize({width:360,height:800});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('Browser checks passed: landing page, favicon, BOT Chain links, wallet-required routes, missing-wallet guidance, keyboard dismissal, and mobile layout. No wallet or network was mocked.');
}finally{await browser.close()}
