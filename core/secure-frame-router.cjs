'use strict';
/**
 * Authenticated Noise frame router for chat, heartbeat and RTC signalling.
 *
 * Not an encryption primitive. Send/receive are ONLY connected to a
 * verified peer's pinned Noise stream; never pass UI-controlled auth claims.
 * All channels share ONE versioned transport sequence, but adapters expose
 * independent component-specific sequence numbers.
 */
const VERSION=1,MAX_BYTES=98304;
const CHANNELS=new Set(['control','heartbeat','rtc']);
function safeId(s){return typeof s==='string'&&s.length>=12&&s.length<=180&&/^[A-Za-z0-9_-]+$/.test(s);}
class SecureFrameRouter {
 constructor({sessionId,localPeerId,remotePeerId,sendAuthenticated,onControl,onHeartbeat,
   onRtc,onFailure=()=>{}}){
  if(!safeId(sessionId)||!safeId(localPeerId)||!safeId(remotePeerId)||
     localPeerId===remotePeerId)throw Error('Pinned distinct peer IDs and session required');
  for(const fn of [sendAuthenticated,onControl,onHeartbeat,onRtc,onFailure])
   if(typeof fn!=='function')throw Error('Authenticated router callback required');
  Object.assign(this,{sessionId,localPeerId,remotePeerId,sendAuthenticated,onControl,
   onHeartbeat,onRtc,onFailure});
  this.sentSequence=0;this.receivedSequence=0;
  this.controlReceived=0;this.rtcReceived=0;
  this.closed=false;this.incoming=Promise.resolve();this.sending=Promise.resolve();
 }
 fail(reason='Invalid authenticated session frame'){
  if(this.closed)return false;
  this.closed=true;
  try{this.onFailure(reason);}catch{}
  return false;
 }
 async send(channel,payload){
  if(this.closed||!CHANNELS.has(channel)||!payload||typeof payload!=='object'||
     Array.isArray(payload)||typeof payload.kind!=='string')return false;
  const seq=++this.sentSequence;
  const frame={version:VERSION,channel,kind:payload.kind,
   payload:{...payload},seq,sessionId:this.sessionId,sender:this.localPeerId};
  const bytes=new TextEncoder().encode(JSON.stringify(frame));
  if(bytes.length>MAX_BYTES)return this.fail('Outbound frame exceeds size limit');
  const task=this.sending.then(async()=>{
   if(this.closed) return false;
   const result=await this.sendAuthenticated(frame);
   if(result===false)return this.fail('Encrypted transport refused frame');
   return !this.closed;
  });
  this.sending=task.catch(()=>{});
  try{return await task;}catch{return this.fail('Encrypted stream failed');}
 }
 async receive(frame,{noiseRemotePeerId}={}){
  // Serial processing prevents late async SDP operations from reordering
  // an otherwise legitimate stream of frames.
  const task=this.incoming.then(()=>this.handle(frame,noiseRemotePeerId));
  this.incoming=task.catch(()=>{});
  try{return await task;}catch{return this.fail('Authenticated handler failed');}
 }
 async handle(frame,noiseRemotePeerId){
  if(this.closed)return false;
  if(noiseRemotePeerId!==this.remotePeerId||!frame||
     frame.version!==VERSION||frame.sessionId!==this.sessionId||
     frame.sender!==this.remotePeerId||!Number.isSafeInteger(frame.seq)||
     frame.seq!==this.receivedSequence+1||
     !CHANNELS.has(frame.channel)||frame.kind!==frame.payload?.kind||
     typeof frame.payload!=='object'||Array.isArray(frame.payload))
    return this.fail('Wrong peer, session, version or sequence');
  if(new TextEncoder().encode(JSON.stringify(frame)).length>MAX_BYTES)
    return this.fail('Incoming frame too large');
  const p=frame.payload;
  let accepted=false;
  if(frame.channel==='control'){
   const localSeq=this.controlReceived+1;
   accepted=await this.onControl({...p,sessionId:this.sessionId,
    sender:this.remotePeerId,seq:localSeq},{noiseRemoteDeviceId:this.remotePeerId});
   if(accepted)this.controlReceived=localSeq;
  }else if(frame.channel==='heartbeat'){
   accepted=await this.onHeartbeat({...p,sessionId:this.sessionId},
    {authenticatedRemotePeerId:this.remotePeerId});
  }else{
   const localSeq=this.rtcReceived+1;
   accepted=await this.onRtc({...p,sessionId:this.sessionId,
    senderDevice:this.remotePeerId,seq:localSeq},
    {fromAuthenticatedPinnedNoisePeer:true});
   if(accepted)this.rtcReceived=localSeq;
  }
  if(accepted!==true)return this.fail('Authenticated frame rejected by session policy');
  this.receivedSequence=frame.seq;
  return !this.closed;
 }
 close(){this.closed=true;}
}
module.exports={SecureFrameRouter,VERSION,MAX_BYTES};
