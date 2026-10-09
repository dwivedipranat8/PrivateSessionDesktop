import {randomBytes} from 'node:crypto';
// The server learns only approved public peer IDs, roles and short-lived
// lease handles. It never learns either account passphrase or chat plaintext.
// One active device per *role*, derived ONLY from Noise-authenticated peer IDs.
const ROLE_FOR_DEVICE=Object.freeze({partner:'host',portable:'protected'});
const MAX_LIFETIME_MS=3000;
export class AccountSessions {
 constructor({enrolled,clock=()=>performance.now(),makeId=()=>randomBytes(32).toString('base64url'),
 onRevoked=()=>{},lifetimeMs=MAX_LIFETIME_MS}={}){
  if(!(enrolled instanceof Map)||typeof clock!=='function'||typeof makeId!=='function'||
      typeof onRevoked!=='function'||lifetimeMs<1000||lifetimeMs>MAX_LIFETIME_MS)
   throw Error('Pinned peer allowlist and bounded lease required');
  this.enrolled=enrolled;this.clock=clock;this.makeId=makeId;
  this.onRevoked=onRevoked;this.lifetimeMs=lifetimeMs;
  this.active=new Map();this.generation=new Map();
 }
 roleFor(peerId){
  if(typeof peerId!=='string')return null;
  return ROLE_FOR_DEVICE[this.enrolled.get(peerId)]||null;
 }
 revoke(current,why){
  if(!current||current.revoked)return;
  current.revoked=true;
  try{
   const event=this.onRevoked({peerId:current.peerId,role:current.role,generation:current.generation,reason:why});
   if(event&&typeof event.catch==='function')event.catch(()=>{});
  }
  catch{/* A notification failure cannot resurrect an old lease. */}
 }
 begin({authenticatedPeerId}={}){
  const role=this.roleFor(authenticatedPeerId);
  if(!role)throw Error('Account enrollment required; password alone is insufficient');
  const previous=this.active.get(role);
  const generation=(this.generation.get(role)||0)+1;
  const sessionId=this.makeId();
  if(typeof sessionId!=='string'||sessionId.length<24||
     (previous&&sessionId===previous.sessionId))
   throw Error('Unpredictable fresh session token required');
  const t=this.clock();
  if(!Number.isFinite(t))throw Error('Clock unavailable');
  // Commit new lease before sending any revocation notice; prevents dual-login.
  const next={role,peerId:authenticatedPeerId,generation,sessionId,expires:t+this.lifetimeMs,revoked:false};
  this.generation.set(role,generation);this.active.set(role,next);
  if(previous)this.revoke(previous,'superseded_by_new_authorized_device');
  return {role,sessionId,generation,expiresInMs:this.lifetimeMs};
 }
 isCurrentDevice(peerId){
  const role=this.roleFor(peerId);
  if(!role)return false;
  const current=this.active.get(role);
  if(!current||current.revoked||current.peerId!==peerId)return false;
  if(this.clock()>=current.expires){
   this.active.delete(role);this.revoke(current,'lease_expired');
   return false;
  }
  return true;
 }
 isActive({authenticatedPeerId,sessionId,generation}={}){
  const role=this.roleFor(authenticatedPeerId);
  if(!role||typeof sessionId!=='string'||!Number.isSafeInteger(generation))return false;
  const current=this.active.get(role);
  if(!current||current.revoked||current.peerId!==authenticatedPeerId||
     current.sessionId!==sessionId||current.generation!==generation)return false;
  if(this.clock()>=current.expires){
   // Drop the expired generation BEFORE notifying connection teardown.
   this.active.delete(role);this.revoke(current,'lease_expired');return false;
  }
  return true;
 }
 renew(frame){
  if(!this.isActive(frame))return {ok:false,error:'revoked_or_expired'};
  const role=this.roleFor(frame.authenticatedPeerId);
  const current=this.active.get(role);
  const now=this.clock();current.expires=now+this.lifetimeMs;
  return {ok:true,role,generation:current.generation,expiresInMs:this.lifetimeMs};
 }
 end(frame){
  if(!this.isActive(frame))return false;
  const role=this.roleFor(frame.authenticatedPeerId);
  const current=this.active.get(role);
  this.active.delete(role);this.revoke(current,'user_ended');
  return true;
 }
 sweep(){
  for(const [role,current] of this.active){
   if(this.clock()>=current.expires||this.roleFor(current.peerId)!==role){
    this.active.delete(role);this.revoke(current,'lease_expired_or_device_revoked');
   }
  }
 }
}
