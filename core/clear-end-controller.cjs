'use strict';
const {randomBytes}=require('node:crypto');
/*
 * Safe-side effect coordinator, NOT a claim of remote forensic deletion.
 * All inbound callbacks must already be dispatched from pinned Noise.
 * On either user's Clear & End: locally cover, stop media and clear first,
 * then (best-effort) issue an encrypted request/ack and dispose transport.
 */
class ClearEndController {
 constructor({hide,stopMedia,clearChat,sendAuthenticated,dispose,
   makeRequestId=()=>randomBytes(24).toString('base64url'),timeoutMs=250}={}){
  for(const fn of [hide,stopMedia,clearChat,sendAuthenticated,dispose,makeRequestId])
   if(typeof fn!=='function')throw Error('Fail-closed operation missing');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>1000)throw Error('Invalid cleanup timeout');
  Object.assign(this,{hide,stopMedia,clearChat,sendAuthenticated,dispose,makeRequestId,timeoutMs});
  this.ended=false;this.requestId=null;this.peerConfirmed=false;this.disposed=false;this.resolveAck=null;
 }
 wipe(){
  if(this.ended)return false;
  this.ended=true;
  for(const callback of [this.hide,this.stopMedia,this.clearChat]){try{callback();}catch{}}
  return true;
 }
 acknowledgeRemoteAck(requestId,{fromAuthenticatedPinnedPeer=false}={}){
  if(this.disposed||!this.ended||fromAuthenticatedPinnedPeer!==true||
     requestId!==this.requestId||this.requestId===null)return false;
  this.peerConfirmed=true;if(this.resolveAck)this.resolveAck(true);return true;
 }
 async attempt(frame){
  let timer=null;
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(false),this.timeoutMs);});
  try{
   return await Promise.race([
    Promise.resolve().then(()=>this.sendAuthenticated(frame)).then(x=>x===true,()=>false),
    timeout
   ]);
  }finally{if(timer!==null)clearTimeout(timer);}
 }
 finish(){
  if(this.disposed)return;
  this.disposed=true;this.resolveAck=null;try{this.dispose();}catch{}
 }
 async localClear(){
  if(!this.wipe())return {localCleared:true,remoteConfirmed:this.peerConfirmed,alreadyEnded:true};
  const id=this.makeRequestId();
  if(typeof id!=='string'||id.length<16||id.length>128||!/^[A-Za-z0-9_-]+$/.test(id)){
   this.finish();return {localCleared:true,remoteConfirmed:false,deliveryAttempted:false};
  }
  this.requestId=id;
  try{
   const delivered=await this.attempt({kind:'clear_end',requestId:id});
   if(delivered&&!this.peerConfirmed){
    // A successful encrypted write is NOT a peer ACK. The content is already
    // hidden, sensors stopped; bound the time keys can remain alive for ACK.
    let timer=null;
    try{
     await Promise.race([
      new Promise(resolve=>{this.resolveAck=resolve;}),
      new Promise(resolve=>{timer=setTimeout(()=>resolve(false),this.timeoutMs);})
     ]);
    }finally{
     this.resolveAck=null;if(timer!==null)clearTimeout(timer);
    }
   }
   return {localCleared:true,deliveryAttempted:delivered,remoteConfirmed:this.peerConfirmed};
  }finally{this.finish();}
 }
 async remoteClear(requestId,{fromAuthenticatedPinnedPeer=false}={}){
  if(fromAuthenticatedPinnedPeer!==true||typeof requestId!=='string'||
     requestId.length<16||requestId.length>128||!/^[A-Za-z0-9_-]+$/.test(requestId))return false;
  if(!this.wipe())return false;
  try{await this.attempt({kind:'clear_ack',requestId});}
  finally{this.finish();}
  return true;
 }
}
module.exports={ClearEndController};
