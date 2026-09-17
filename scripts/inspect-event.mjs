import fs from 'node:fs';
import {JsonRpcProvider,Contract,formatEther} from 'ethers';
const deployment=JSON.parse(fs.readFileSync('src/contracts/deployment.json','utf8'));
const abi=JSON.parse(fs.readFileSync('src/contracts/Ticketa.json','utf8'));
const provider=new JsonRpcProvider(deployment.rpcUrl,undefined,{batchMaxCount:1,cacheTimeout:0});
try{
 const c=new Contract(deployment.address,abi,provider),block=await provider.getBlock('latest'),count=Number(await c.eventCount());
 console.log('Testnet time:',new Date(block.timestamp*1000).toISOString());
 for(let id=1;id<=count;id++){const {info,tiers}=await c.getFunction('getEvent')(id);if(info.details.name.toLowerCase()!=='sparks')continue;console.log(JSON.stringify({id,organizer:info.organizer,name:info.details.name,startsAt:new Date(Number(info.details.startsAt)*1000).toISOString(),endsAt:new Date(Number(info.details.endsAt)*1000).toISOString(),sold:String(info.sold),tiers:tiers.map(t=>({name:t.name,price:formatEther(t.price),capacity:String(t.capacity),minted:String(t.minted)}))}));try{await c.purchase.staticCall(id,0,{from:info.organizer,value:tiers[0].price});console.log('Purchase available')}catch(e){console.log('Purchase rejection:',e.reason||e.shortMessage)}}
}finally{provider.destroy()}
