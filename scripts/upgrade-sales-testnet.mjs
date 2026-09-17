import fs from 'node:fs';
import {JsonRpcProvider,Wallet,Contract,ContractFactory,keccak256,AbiCoder,formatEther} from 'ethers';
import {loadEnv} from './env.mjs';
const env=loadEnv(),provider=new JsonRpcProvider('https://rpc.bohr.life',undefined,{batchMaxCount:1,cacheTimeout:0});
const previous=JSON.parse(fs.readFileSync('deployments/0x1b2615E2f5596b70Dee522a8d558ddc3f284C10e/deployment.json','utf8'));
try{
 if(Number((await provider.getNetwork()).chainId)!==968)throw Error('Upgrade requires BOT Chain Testnet.');
 const artifact=JSON.parse(fs.readFileSync('artifacts/Ticketa.json','utf8')),input=JSON.parse(fs.readFileSync('artifacts/standard-input.json','utf8'));
 if(input.sources['contracts/Ticketa.sol'].content!==fs.readFileSync('contracts/Ticketa.sol','utf8'))throw Error('Compile the current source before upgrading.');
 const wallet=new Wallet(env.PRIVATE_KEY,provider);
 const legacyAbi=JSON.parse(fs.readFileSync('deployments/'+previous.address+'/abi.json','utf8'));
 const legacy=new Contract(previous.address,legacyAbi,provider);
 const original=await legacy.getFunction('getEvent')(1);
 async function guard(){if(Number(await legacy.eventCount())!==1||Number(await legacy.ticketCount())!==0)throw Error('The original deployment now contains additional events or tickets. Keep the current website configuration and review migration.');const event=await legacy.getFunction('getEvent')(1);if(event.info.organizer.toLowerCase()!==wallet.address.toLowerCase()||event.info.details.name!=='Sparks'||event.info.sold!==0n)throw Error('Sparks cannot be safely migrated with the deployment wallet.');const block=await provider.getBlock('latest');if(Number(event.info.details.endsAt)<=block.timestamp)throw Error('Sparks has ended. Do not migrate an ended event.');return event}
 await guard();
 const candidateFile='artifacts/sales-upgrade-candidate.json';let candidate;
 if(fs.existsSync(candidateFile)){candidate=JSON.parse(fs.readFileSync(candidateFile,'utf8'));if(candidate.bytecodeHash!==keccak256('0x'+artifact.evm.bytecode.object))throw Error('Pending deployment source differs. Review before redeploying.');if(await provider.getCode(candidate.address)==='0x')throw Error('Pending deployment has no code.');}
 else{
  const factory=new ContractFactory(artifact.abi,artifact.evm.bytecode.object,wallet);
  const request=await factory.getDeployTransaction(previous.address),gas=await provider.estimateGas({...request,from:wallet.address}),fee=await provider.getFeeData();
  console.log('Upgrade estimated deployment fee:',formatEther(gas*(fee.maxFeePerGas||fee.gasPrice)),'BOT');
  const contract=await factory.deploy(previous.address,{gasLimit:gas*120n/100n});console.log('Upgrade deployment transaction:',contract.deploymentTransaction().hash);
  const receipt=await contract.deploymentTransaction().wait(2);if(!receipt||receipt.status!==1)throw Error('Upgrade deployment was not confirmed.');
  candidate={...previous,address:await contract.getAddress(),blockNumber:receipt.blockNumber,transactionHash:receipt.hash,bytecodeHash:keccak256('0x'+artifact.evm.bytecode.object),deployedAt:new Date().toISOString(),verified:false,previousAddress:previous.address,constructorArguments:AbiCoder.defaultAbiCoder().encode(['address'],[previous.address]).slice(2),version:2};delete candidate.verifiedAt;
  fs.writeFileSync(candidateFile,JSON.stringify(candidate,null,2)+'\n');
 }
 await guard();
 const next=new Contract(candidate.address,artifact.abi,wallet);
 if((await next.legacyContract()).toLowerCase()!==previous.address.toLowerCase())throw Error('The upgrade references a different legacy contract.');
 let id=await next.importedLegacyEvents(1);
 if(id===0n){const tx=await next.importLegacyEvent(1);console.log('Sparks migration transaction:',tx.hash);const receipt=await tx.wait(2);if(!receipt||receipt.status!==1)throw Error('Migration was not confirmed.');candidate.migrationTransactionHash=receipt.hash;id=await next.importedLegacyEvents(1);}
 const migrated=await next.getFunction('getEvent')(id);
 const detailType='tuple(string name,string venue,string description,string category,string imageUrl,uint64 startsAt,uint64 endsAt)';
 const coder=AbiCoder.defaultAbiCoder();if(coder.encode([detailType],[original.info.details])!==coder.encode([detailType],[migrated.info.details]))throw Error('Migrated event details differ. Keep the old configuration.');
 if(migrated.info.organizer.toLowerCase()!==original.info.organizer.toLowerCase())throw Error('Organizer did not match after migration.');
 if(migrated.tiers.length!==original.tiers.length||migrated.tiers.some((t,i)=>t.name!==original.tiers[i].name||t.price!==original.tiers[i].price||t.capacity!==original.tiers[i].capacity||t.minted!==0n))throw Error('Migrated ticket tiers differ.');
 await guard();
 const purchasable=migrated.tiers.findIndex(t=>t.minted<t.capacity);
 const tokenId=await next.purchase.staticCall(id,purchasable,{value:migrated.tiers[purchasable].price});
 console.log('Live purchase preflight passed for Sparks. Next ticket ID:',String(tokenId),'(no ticket was purchased by this script)');
 candidate.migratedEvent={legacyId:1,id:Number(id),name:'Sparks'};
 fs.writeFileSync('src/contracts/deployment.json',JSON.stringify(candidate,null,2)+'\n');fs.writeFileSync(candidateFile,JSON.stringify(candidate,null,2)+'\n');
 console.log('Activated deployment:',candidate.address,'Sparks event ID:',String(id));
}catch(e){console.error((e.shortMessage||e.message||'Upgrade failed.').replaceAll(env.PRIVATE_KEY||'__no_key__','[redacted]').replaceAll(env.BLOCKSCOUT_API_KEY||'__no_api_key__','[redacted]'));process.exitCode=1}finally{provider.destroy()}
