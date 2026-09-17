import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
const sources={'contracts/Ticketa.sol':{content:fs.readFileSync('contracts/Ticketa.sol','utf8')}};
function addImports(name){for(const match of sources[name].content.matchAll(/import\s+(?:[^;]*?\sfrom\s+)?["']([^"']+)["']/g)){const imported=match[1].startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1])):match[1];if(!sources[imported]){sources[imported]={content:fs.readFileSync(path.join('node_modules',imported),'utf8')};addImports(imported)}}}
addImports('contracts/Ticketa.sol');
const input = { language: 'Solidity', sources, settings: { optimizer: { enabled: true, runs: 200 }, viaIR:true, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object','evm.deployedBytecode.object'] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter(e => e.severity === 'error');
if (errors.length) { console.error(errors.map(e => e.formattedMessage).join('\n')); process.exit(1); }
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/Ticketa.json', JSON.stringify(output.contracts['contracts/Ticketa.sol'].Ticketa, null, 2));
fs.writeFileSync('artifacts/standard-input.json',JSON.stringify(input));
fs.writeFileSync('artifacts/compiler-version.txt',solc.version());
fs.mkdirSync('src/contracts',{recursive:true});
fs.writeFileSync('src/contracts/Ticketa.json',JSON.stringify(output.contracts['contracts/Ticketa.sol'].Ticketa.abi));
console.log('Ticketa compiled successfully. ABI and bytecode: artifacts/Ticketa.json');
