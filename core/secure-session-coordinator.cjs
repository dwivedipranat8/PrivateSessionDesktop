'use strict';
/**
 * Security critical orchestration glue. All calls on this module must
 * originate from actual verified libp2p Noise peer streams and trusted native
 * device/OS guards. The Electron renderer cannot assert peer authentication.
 * Nothing here is persistent. Host callbacks must hide before awaiting I/O.
 */
const {PeerLease}=require('./peer-lease.cjs');
class SecureSessionCoordinator{
 constructor({sessionId,remotePeerId,clock,random,guards,sendNoise,hide,
   stopMedia,clearChat,destroyEphemeralKeys,closeTransport,closeWindow}){
  if(typeof sessionId!=='string'||sessionId.length<12||typeof remotePeerId!=='string'||remotePeerId.length<12)
   throw Error('Verified identity and session required');
  for(const fn of [clock,guards,sendNoise,hide,stopMedia,clearChat,destroyEphemeralKeys,closeTransport,closeWindow])
   if(typeof fn!=='function')throw Error('Missing fail-closed callback');
  this.sessionId=sessionId;this.remotePeerId=remotePeerId;
  Object.assign(this,{clock,guards,sendNoise,hide,stopMedia,clearChat,destroyEphemeralKeys,closeTransport,closeWindow});
  this.phase='starting';this.lastChallengeAt=null;this.stopExecuted=false;this.opened=false;
  this.lease=new PeerLease({
    sessionId,clock,random,onProtect:()=>this.protect(),
    onExpire:()=>this.finish()
  });
 }
 healthyGuards(){
  try{
   const status=this.guards();
   return status&&status.network===true&&status.volume===true&&status.camera===true&&
     status.microphone===true&&status.trust===true;
  }catch{return false;}
 }
 protect(){
  if(this.stopExecuted)return;
  this.stopExecuted=true;this.phase='protected';
  // No await before covering and releasing sensors.
  for(const operation of [this.hide,this.stopMedia,this.clearChat]){
   try{operation();}catch{/* All callbacks attempted despite failure */ }
  }
 }
 finish(){
  this.protect();this.phase='expired';
  for(const operation of [this.destroyEphemeralKeys,this.closeTransport,this.closeWindow]){
   try{operation();}catch{}
  }
 }
 fail(reason='Protection condition failed'){
  if(this.phase==='expired')return;
  this.reason=reason;this.lease.invalidate();
 }
 async tick(){
  if(this.phase==='expired')return this.phase;
  if(!this.healthyGuards()){this.fail('Device, Internet or sensor unavailable');return this.phase;}
  this.lease.tick();
  if(this.lease.phase==='expired')return this.phase;
  const now=this.clock();
  if(this.lastChallengeAt===null||now-this.lastChallengeAt>=1000){
   this.lastChallengeAt=now;
   const frame=this.lease.challenge();
   if(frame){
    try{await this.sendNoise(frame);}
    catch{this.fail('Authenticated peer connection lost');}
   }
  }
  return this.phase;
 }
 async fromPinnedNoise(frame,{authenticatedRemotePeerId}={}){
  if(this.phase==='expired'||this.phase==='protected'||authenticatedRemotePeerId!==this.remotePeerId)return false;
  if(!this.healthyGuards()){this.fail('Local guard failed');return false;}
  if(!frame||frame.sessionId!==this.sessionId)return false;
  if(frame.kind==='challenge'&&typeof frame.token==='string'&&frame.token.length>=20){
   try{
    await this.sendNoise({kind:'response',sessionId:this.sessionId,token:frame.token});
    return true;
   }catch{this.fail('Cannot respond to authenticated peer');return false;}
  }
  if(frame.kind==='response'){
   const fresh=this.lease.accept(frame,{authenticated:true});
   if(fresh&&!this.opened){
    this.opened=true;this.phase='active';
   }
   return fresh;
  }
  return false;
 }
 get canDisplay(){return this.phase==='active'&&!this.stopExecuted&&this.lease.active&&this.healthyGuards();}
}
module.exports={SecureSessionCoordinator};
