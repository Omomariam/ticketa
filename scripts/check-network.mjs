import {JsonRpcProvider,Wallet,formatEther} from 'ethers';
import {loadEnv} from './env.mjs';
const env=loadEnv();
const rpc=new JsonRpcProvider('https://rpc.bohr.life',undefined,{batchMaxCount:1});
try {
 const network=await rpc.getNetwork();
 if(network.chainId!==968n)throw Error('The RPC is not BOT Chain testnet.');
 const wallet=new Wallet(env.PRIVATE_KEY,rpc);
 console.log(JSON.stringify({chainId:Number(network.chainId),block:await rpc.getBlockNumber(),deployer:wallet.address,balance:formatEther(await rpc.getBalance(wallet.address)),verificationKeyPresent:!!env.BLOCKSCOUT_API_KEY}));
 for(const url of ['https://scan.bohr.life/api/v2/stats','https://scan.bohr.life/api?module=contract&action=listcontracts','https://api.blockscout.com/api/v1/chains']){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});console.log(url,r.status,(await r.text()).slice(0,350))}catch{console.log(url,'Unavailable')}
 }
}catch(e){console.error('Network check failed:',e.code||'Unable to reach testnet or read deployment credentials');process.exitCode=1}finally{rpc.destroy()}
