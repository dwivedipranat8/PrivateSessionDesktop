'use strict';
export const ROLES=Object.freeze({BUILDER:'builder',PARTNER:'partner',PORTABLE:'portable'});
/*
 * Minimal identity metadata needed for relay enrollment: no real names,
 * email, phone numbers, conversations or raw private keys.
 */
export function parseEnrolled(text){
 let list;
 try{list=JSON.parse(text);}catch{throw Error('Invalid enrollment configuration');}
 if(!Array.isArray(list)||list.length===0||list.length>16)throw Error('Explicit device allowlist required');
 const result=new Map();
 for(const item of list){
  if(!item||typeof item.peerId!=='string'||item.peerId.length<20||
     !Object.values(ROLES).includes(item.role)||result.has(item.peerId))
   throw Error('Invalid or duplicate peer');
  if(item.revoked!==true)result.set(item.peerId,item.role);
 }
 if(result.size===0)throw Error('No active enrolled devices');
 return result;
}
export function permittedPair(enrolled,a,b){
 if(!a||!b||a===b||!enrolled.has(a)||!enrolled.has(b))return false;
 const roles=[enrolled.get(a),enrolled.get(b)].sort().join('|');
 return roles==='partner|portable'||roles==='builder|partner';
}
export function admit(enrolled,peer){
 return typeof peer==='string'&&enrolled.has(peer);
}
