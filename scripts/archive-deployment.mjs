import fs from 'node:fs';
const d=JSON.parse(fs.readFileSync('src/contracts/deployment.json','utf8'));
const dir='deployments/'+d.address;
fs.mkdirSync(dir,{recursive:true});
for(const [source,target]of [['src/contracts/deployment.json','deployment.json'],['src/contracts/Ticketa.json','abi.json'],['contracts/Ticketa.sol','Ticketa.sol'],['artifacts/Ticketa.json','artifact.json'],['artifacts/standard-input.json','standard-input.json'],['artifacts/compiler-version.txt','compiler-version.txt']]){if(!fs.existsSync(dir+'/'+target))fs.copyFileSync(source,dir+'/'+target)}
console.log('Original deployed source and configuration archived:',dir);
