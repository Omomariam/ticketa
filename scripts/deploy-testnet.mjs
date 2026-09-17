import fs from 'node:fs';
import {JsonRpcProvider,Wallet,ContractFactory,formatEther,keccak256} from 'ethers';
import {loadEnv} from './env.mjs';
const env=loadEnv();
const provider=new JsonRpcProvider('https://rpc.bohr.life',undefined,{batchMaxCount:1});
try {
 const network=await provider.getNetwork();
 if(network.chainId!==968n)throw Error('Deployment stopped: expected BOT Chain testnet (968).');
 const artifact=JSON.parse(fs.readFileSync('artifacts/Ticketa.json','utf8'));
 const compiledInput=JSON.parse(fs.readFileSync('artifacts/standard-input.json','utf8'));
 if(compiledInput.sources['contracts/Ticketa.sol'].content!==fs.readFileSync('contracts/Ticketa.sol','utf8'))throw Error('Compile the current contract source before deploying.');
 const wallet=new Wallet(env.PRIVATE_KEY,provider);
 const file='src/contracts/deployment.json';
 if(fs.existsSync(file)) {
  const existing=JSON.parse(fs.readFileSync(file,'utf8'));
  if(existing.address){const code=await provider.getCode(existing.address);if(existing.chainId!==968||code==='0x'||existing.bytecodeHash!==keccak256('0x'+artifact.evm.bytecode.object))throw Error('Existing deployment differs from compiled source. Review before redeploying.');console.log('Existing contract deployment:',existing.address);process.exitCode=0;}
  else await deploy();
 }else await deploy();
 async function deploy(){
  const factory=new ContractFactory(artifact.abi,artifact.evm.bytecode.object,wallet);
  const request=await factory.getDeployTransaction();
  const gas=await provider.estimateGas({...request,from:wallet.address});
  const fees=await provider.getFeeData();
  const balance=await provider.getBalance(wallet.address);
  const estimate=gas*(fees.maxFeePerGas||fees.gasPrice);
  console.log('Testnet deployment estimated cost:',formatEther(estimate),'BOT');
  if(balance<estimate)throw Error('The deployer needs more testnet BOT for deployment.');
  const contract=await factory.deploy({gasLimit:gas*120n/100n});
  console.log('Deployment transaction:',contract.deploymentTransaction().hash);
  const receipt=await contract.deploymentTransaction().wait(2);
  if(!receipt||receipt.status!==1)throw Error('Deployment was not confirmed.');
  const address=await contract.getAddress();
  if(await provider.getCode(address)==='0x')throw Error('No contract code found after deployment.');
  const data={chainId:968,name:'BOT Chain Testnet',rpcUrl:'https://rpc.bohr.life',explorerUrl:'https://scan.bohr.life',address,blockNumber:receipt.blockNumber,transactionHash:receipt.hash,deployer:wallet.address,bytecodeHash:keccak256('0x'+artifact.evm.bytecode.object),deployedAt:new Date().toISOString(),verified:false};
  fs.mkdirSync('src/contracts',{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
  console.log('Ticketa deployed:',address,'at block',receipt.blockNumber);
 }
}catch(e){console.error(e.message?.includes('PRIVATE')?'Unable to read deployment credentials.':e.shortMessage||e.message||'Deployment could not be completed.');process.exitCode=1}finally{provider.destroy()}
