import fs from 'node:fs';
import {loadEnv} from './env.mjs';
const env=loadEnv();
const file='src/contracts/deployment.json';
const deployment=JSON.parse(fs.readFileSync(file,'utf8'));
const endpoint=deployment.explorerUrl+'/api';
function params(action){return new URLSearchParams({module:'contract',action,apikey:env.BLOCKSCOUT_API_KEY||''})}
async function request(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('Explorer verification service is unavailable ('+r.status+').');return r.json()}
async function isVerified(){const p=params('getsourcecode');p.set('address',deployment.address);const data=await request(endpoint+'?'+p);return data.result?.[0]?.SourceCode?.length>0}
function save(){deployment.verified=true;deployment.verifiedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(deployment,null,2)+'\n');console.log('Verified contract:',deployment.explorerUrl+'/address/'+deployment.address+'?tab=contract')}
try {
 if(await isVerified())save();
 else {
  const p=params('verifysourcecode');
  p.set('contractaddress',deployment.address);p.set('contractname','contracts/Ticketa.sol:Ticketa');p.set('codeformat','solidity-standard-json-input');p.set('sourceCode',fs.readFileSync('artifacts/standard-input.json','utf8'));p.set('compilerversion','v'+fs.readFileSync('artifacts/compiler-version.txt','utf8').split('.Emscripten')[0]);p.set('constructorArguments','');p.set('licenseType','3');
  const result=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p});
  if(result.status!=='1'){if(await isVerified())save();else throw Error('Explorer did not accept verification: '+String(result.result).slice(0,250))}
  else {
   fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/verification-status.json',JSON.stringify({guid:result.result,address:deployment.address}));
   const check=params('checkverifystatus');check.set('guid',result.result);
   let success=false;
   for(let i=0;i<12;i++){
    await new Promise(resolve=>setTimeout(resolve,5000));
    const status=await request(endpoint+'?'+check);
    console.log('Verification:',status.result);
    if(/Pass|Already Verified/i.test(status.result)||await isVerified()){success=true;save();break}
    if(/Fail|Unable to verify|Unknown/i.test(status.result))throw Error('Explorer could not verify this build: '+String(status.result).slice(0,200));
   }
   if(!success)throw Error('Verification is still pending. Re-run verification to check the result.');
  }
 }
}catch(e){console.error(e.message?.replaceAll(env.BLOCKSCOUT_API_KEY||'__no_key__','[redacted]'));process.exitCode=1}
