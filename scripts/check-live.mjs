import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {loadEnv} from './env.mjs';
const server=await createServer({server:{middlewareMode:true}});
let chain;
try {
 chain=await server.ssrLoadModule('/src/lib/chain.js');
 const deployment=JSON.parse(fs.readFileSync('src/contracts/deployment.json','utf8'));
 assert.equal(Number((await chain.reader.getNetwork()).chainId),968);
 assert.notEqual(await chain.reader.getCode(deployment.address),'0x');
 assert.equal(await chain.contract.name(),'Ticketa');
 assert.equal(await chain.contract.symbol(),'TKT');
 const data=await chain.readSnapshot(deployment.deployer);
 assert.equal(data.events.length,Number(await chain.contract.eventCount()));
 assert.equal(data.tickets.length,Number(await chain.contract.balanceOf(deployment.deployer)));
 const domain=await chain.contract.eip712Domain();assert.equal(Number(domain.chainId),968);assert.equal(domain.verifyingContract,deployment.address);
 assert.equal(chain.userError({code:4001}),'You cancelled the wallet request. Nothing was changed.');
 assert.equal(chain.userError({code:'INSUFFICIENT_FUNDS'}).includes('testnet BOT'),true);
 assert.equal(chain.userError({reason:'Outside event window'}).includes('event start'),true);
 const env=loadEnv();const secrets=[env.PRIVATE_KEY,env.BLOCKSCOUT_API_KEY].filter(Boolean);
 function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name])}
 for(const file of files('dist')){const content=fs.readFileSync(file,'utf8');for(const secret of secrets)assert.equal(content.includes(secret),false,'A deployment credential must never appear in a public build');assert.equal(/demo ticket|demo collection|simulated|ETH Lagos 2026/.test(content),false,'The production build must not contain demo content')}
 console.log('Live testnet checks passed:',JSON.stringify({address:deployment.address,block:data.block,events:data.events.length,tickets:data.tickets.length,verified:deployment.verified}));
 console.log('Credential isolation and user-facing error checks passed.');
}finally{chain?.reader.destroy();await server.close()}
