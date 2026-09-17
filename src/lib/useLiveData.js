import {useState,useEffect,useCallback,useRef} from 'react';
import {readSnapshot,userError,CHAIN} from './chain';
export function useLiveData(session){
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const generation=useRef(0),running=useRef(null),current=useRef(session);current.current=session;
 const refresh=useCallback(async function load(force=false){const s=current.current;if(!s||s.chainId!==CHAIN.id)return;if(running.current){if(force===true){await running.current;return load(true)}return running.current}const version=generation.current;setLoading(true);const task=(async()=>{try{const snapshot=await readSnapshot(s.address);if(version===generation.current){setData(snapshot);setError('')}}catch(e){if(version===generation.current)setError(userError(e,'load events and tickets'))}finally{if(version===generation.current){running.current=null;setLoading(false)}}})();running.current=task;return task},[]);
 useEffect(()=>{generation.current++;running.current=false;setData(null);setError('');if(!session||session.chainId!==CHAIN.id)return;refresh();const interval=setInterval(refresh,10000);const visible=()=>{if(document.visibilityState==='visible')refresh()};document.addEventListener('visibilitychange',visible);return()=>{generation.current++;clearInterval(interval);document.removeEventListener('visibilitychange',visible)}},[session?.address,session?.chainId,refresh]);
 return {data,error,loading,refresh};
}
