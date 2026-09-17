import fs from 'node:fs';
import assert from 'node:assert/strict';
import {keccak256} from 'ethers';
const input=JSON.parse(fs.readFileSync('artifacts/standard-input.json','utf8'));
const artifact=JSON.parse(fs.readFileSync('artifacts/Ticketa.json','utf8'));
const deployment=JSON.parse(fs.readFileSync('src/contracts/deployment.json','utf8'));
assert.equal(input.sources['contracts/Ticketa.sol'].content,fs.readFileSync('contracts/Ticketa.sol','utf8'),'Compiled source must match current source');
assert.equal(keccak256('0x'+artifact.evm.bytecode.object),deployment.bytecodeHash,'Deployed creation bytecode must match compiled bytecode');
console.log('Current source, compiled artifacts, and deployment bytecode hash match.');
