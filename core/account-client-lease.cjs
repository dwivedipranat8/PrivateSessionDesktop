'use strict';
/**
 * Client watchdog for the server's single-device lease.
 *
 * Call tick() from a 250-500ms native/main-process timer and fail() on an
 * immediate OS network/USB/lock event. Transport MUST pin the Noise server's
 * public peer identity and never accept a renderer-supplied assertion.
 */
class AccountClientLease {
 constructor({role,clock=()=>performance.now(),sendRenew,onStop}={}){
  if(!['host','protected'].includes(role)||typeof clock!=='function'||
   typeof sendRenew!=='function'||typeof onStop!=='function')
    throw Error('Pinned role, monotonic clock and fail-closed callbacks required');
  this.role=role;this.clock=clock;this.sendRenew=sendRenew;this.onStop=onStop;
  this.deadline=null;this.sessionId=null;this.generation=null;this.closed=true;this.busyKey=null;this.operationSequence=0;
 }
 begin(lease){
  if(!this.closed||typeof lease?.sessionId!=='string'||lease.sessionId.length<24||
    lease.role!==this.role||!Number.isSafeInteger(lease.generation)||lease.generation<1||
    !Number.isInteger(lease.expiresInMs)||lease.expiresInMs>3000||lease.expiresInMs<1000)
    throw Error('Signed-in account lease is invalid');
  this.sessionId=lease.sessionId;this.generation=lease.generation;
  this.deadline=this.clock()+lease.expiresInMs;this.closed=false;this.busyKey=null;
  return true;
 }
 fail(reason='Account lease invalidated'){
  if(this.closed)return false;
  this.closed=true;this.deadline=null;this.sessionId=null;this.generation=null;this.busyKey=null;
  // Synchronous callback must FIRST conceal content, clear drafts and stop AV.
  this.onStop(reason);
  return true;
 }
 get healthy(){
  return !this.closed&&this.deadline!==null&&this.clock()<this.deadline;
 }
 async tick(){
  if(this.closed)return false;
  if(!this.healthy){this.fail('Account lease expired');return false;}
  if(this.busyKey!==null)return this.healthy;
  const operationKey=++this.operationSequence;
  this.busyKey=operationKey;
  const sessionId=this.sessionId,generation=this.generation,requestedAt=this.clock();
  const belongsToCurrent=()=>!this.closed&&this.busyKey===operationKey&&
    this.sessionId===sessionId&&this.generation===generation;
  try{
   const response=await this.sendRenew({operation:'renew',sessionId,generation});
   // Bound both latency and authority to the original request time. Never
   // extend a lease simply because a packet was delivered late.
   if(!belongsToCurrent())return false;
   if(!this.healthy){this.fail('Account renewal arrived after deadline');return false;}
   if(response?.ok!==true||response.role!==this.role||response.generation!==generation||
     !Number.isInteger(response.expiresInMs)||response.expiresInMs<1000||response.expiresInMs>3000){
    this.fail('Account device was revoked');return false;
   }
   const deadline=requestedAt+response.expiresInMs;
   if(this.clock()>=deadline){this.fail('Account renewal response stale');return false;}
   this.deadline=deadline;
   return true;
  }catch{
   if(belongsToCurrent())this.fail('Server authorization unavailable');
   return false;
  }finally{
   if(this.busyKey===operationKey)this.busyKey=null;
  }
 }
}
module.exports={AccountClientLease};
