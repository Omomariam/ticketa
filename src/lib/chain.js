import {JsonRpcProvider,Contract,formatEther,ZeroAddress} from 'ethers';
import abi from '../contracts/Ticketa.json';
import deployment from '../contracts/deployment.json';

export const CHAIN={id:968,hex:'0x3c8',name:'BOT Chain Testnet',rpc:'https://rpc.bohr.life',explorer:'https://scan.bohr.life',faucet:'https://faucet.botchain.ai'};
export const ADDRESS=deployment.address;
export const DEPLOYMENT_BLOCK=deployment.blockNumber;
export const ABI=abi;
export const reader=new JsonRpcProvider(CHAIN.rpc,undefined,{batchMaxCount:1,cacheTimeout:0});
export const contract=new Contract(ADDRESS,abi,reader);
export const proofTypes={CheckIn:[{name:'ticketId',type:'uint256'},{name:'nonce',type:'uint256'},{name:'deadline',type:'uint256'}]};
export const proofDomain={name:'Ticketa',version:'1',chainId:CHAIN.id,verifyingContract:ADDRESS};
export const sameAddress=(a,b)=>!!a&&!!b&&a.toLowerCase()===b.toLowerCase();
export const shortAddress=a=>a?a.slice(0,6)+'…'+a.slice(-4):'';
export const amount=wei=>formatEther(wei);
export const explorerTx=hash=>CHAIN.explorer+'/tx/'+hash;
export const explorerAddress=address=>CHAIN.explorer+'/address/'+address;
export const imageUrl=value=>/^https:\/\//i.test(value||'')?value:'/event-cover.svg';
export function eventFromChain(view){const e=view.info;return {id:Number(e.id),organizer:e.organizer,...Object.fromEntries(['name','venue','description','category','imageUrl'].map(k=>[k,e.details[k]])),startsAt:Number(e.details.startsAt),endsAt:Number(e.details.endsAt),proceeds:e.proceeds,sold:Number(e.sold),checkedIn:Number(e.checkedIn),tiers:view.tiers.map((t,id)=>({id,name:t.name,price:t.price,capacity:Number(t.capacity),minted:Number(t.minted)}))}}
export function ticketFromChain(t){return {id:Number(t.id),owner:t.owner,eventId:Number(t.info.eventId),tierId:Number(t.info.tierId),used:t.info.used,nonce:t.info.nonce.toString()}}
export async function readSnapshot(wallet){
 const chainId=Number(await reader.send('eth_chainId',[]));if(chainId!==CHAIN.id)throw new Error('wrong_read_network');
 const block=await reader.getBlock('latest');const options={blockTag:block.number};
 const [eventCount,balance,ownedCount]=await Promise.all([contract.eventCount(options),reader.getBalance(wallet,block.number),contract.balanceOf(wallet,options)]);
 const events=[],tickets=[];
 for(let id=1;id<=Number(eventCount);id+=25)events.push(...(await contract.getEvents(id,25,options)).map(eventFromChain));
 for(let offset=0;offset<Number(ownedCount);offset+=100)tickets.push(...(await contract.getOwnedTickets(wallet,offset,100,options)).map(ticketFromChain));
 const staffIds=[];
 for(let i=0;i<events.length;i+=8){const group=events.slice(i,i+8);const allowed=await Promise.all(group.map(e=>sameAddress(e.organizer,wallet)?Promise.resolve(true):contract.checkInStaff(e.id,wallet,options)));group.forEach((e,j)=>{if(allowed[j])staffIds.push(e.id)})}
 return {events,tickets,balance,staffIds,block:block.number,timestamp:block.timestamp,updatedAt:Date.now()};
}
export async function readTransfers(wallet,toBlock,fromBlock){
 const results=[];
 for(let end=toBlock;end>=fromBlock;end-=1000){const start=Math.max(fromBlock,end-999);const logs=await Promise.all([contract.queryFilter(contract.filters.Transfer(wallet,null),start,end),contract.queryFilter(contract.filters.Transfer(null,wallet),start,end)]);results.push(...logs.flat())}
 const seen=new Set();return results.filter(log=>{const key=log.transactionHash+':'+log.index;if(seen.has(key)||sameAddress(log.args.from,ZeroAddress))return false;seen.add(key);return true}).map(log=>({id:log.transactionHash+':'+log.index,tokenId:Number(log.args.tokenId),from:log.args.from,to:log.args.to,block:log.blockNumber,hash:log.transactionHash})).sort((a,b)=>b.block-a.block);
}

export function userError(error,action='complete this request'){
 const code=error?.code??error?.info?.error?.code;
 const reason=(error?.reason||error?.shortMessage||error?.message||'').toLowerCase();
 if(code===4001||code==='ACTION_REJECTED')return 'You cancelled the wallet request. Nothing was changed.';
 if(code===-32002)return 'A wallet request is already open. Open your wallet to approve or cancel it.';
 if(code==='INSUFFICIENT_FUNDS'||reason.includes('insufficient funds'))return 'You need more testnet BOT to cover this payment and the network fee. Get BOT from the faucet, then try again.';
 const messages=[['sold out','This ticket tier is sold out. Choose another tier.'],['sales closed','This event has ended and ticket sales are closed.'],['unknown tier','This ticket tier is no longer available. Refresh the event.'],['organizer only','Only the event organizer can make this change. Connect the organizer wallet.'],['unauthorized','Your wallet is not authorized to check in tickets for this event. Ask the organizer to add you as staff.'],['outside event window','Check-in is available only between the event start and end times.'],['ticket already used','This ticket has already been checked in.'],['invalid or expired proof','This QR code has expired or the ticket changed owners. Ask the attendee to generate a new code.'],['used tickets cannot move','A checked-in ticket cannot be transferred.'],['no proceeds','There are no ticket proceeds available to withdraw.'],['incorrect payment','The ticket price has changed. Refresh the event and try again.'],['event has started','Event details can no longer be edited after the event starts.'],['invalid event dates','Choose a future start time and an end time after the start.'],['invalid event name','Enter an event name of up to 80 characters.'],['invalid venue','Enter a venue of up to 160 characters.'],['details too long','Some event details are too long. Shorten the description or image link.'],['invalid tier','Each tier needs a name and a capacity of at least one.'],['nonexistent','This ticket does not exist. Check the ticket number.'],['event not found','This event could not be found. Refresh the event list.'],['withdrawal failed','The payout could not reach your wallet. Try again or use a wallet that can receive BOT.']];
 for(const [match,message]of messages)if(reason.includes(match))return message;
 if(code==='TRANSACTION_REPLACED'&&error.cancelled)return 'The transaction was cancelled in your wallet. Nothing was changed.';
 if(code==='NETWORK_ERROR'||code==='SERVER_ERROR'||code==='TIMEOUT'||reason.includes('fetch')||reason.includes('network'))return 'We couldn’t reach BOT Chain. Check your connection and try again.';
 if(code==='CALL_EXCEPTION')return 'This action could not be completed. Refresh the page to check the ticket or event status, then try again.';
 return 'We couldn’t '+action+'. Please try again.';
}
