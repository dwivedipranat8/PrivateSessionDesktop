'use strict';
/**
 * Session-bound control parser. REQUIRES actual verified Noise stream from
 * approvedRemoteDevice. Never call with a UI-supplied "authenticated" boolean.
 * All side effects are callbacks; no transcript is persisted here.
 */
class SecureControl {
 constructor({sessionId,approvedRemoteDevice,hostDeviceId,localDeviceId,
             onEnd=()=>{},onClearEnd=()=>{},onSeen=()=>{},onText=()=>{},onSecurityFailure=()=>{}}){
  for(const value of [sessionId,approvedRemoteDevice,hostDeviceId,localDeviceId])
   if(typeof value!=='string'||value.length<8)throw Error('Enrolled identities/session required');
  if(approvedRemoteDevice===localDeviceId)throw Error('Self-peer forbidden');
  Object.assign(this,{sessionId,approvedRemoteDevice,hostDeviceId,localDeviceId,onEnd,onClearEnd,onSeen,onText,onSecurityFailure});
  this.lastSequence=0;this.ended=false;
 }
 receive(frame,{noiseRemoteDeviceId}={}){
  if(this.ended||noiseRemoteDeviceId!==this.approvedRemoteDevice||!frame||
    frame.sender!==noiseRemoteDeviceId||frame.sessionId!==this.sessionId||
    !Number.isSafeInteger(frame.seq)||frame.seq!==this.lastSequence+1)return false;
  if(!['seen','clear_end','end','text','security_fail'].includes(frame.kind))return false;
  if(frame.kind==='seen'&&(typeof frame.messageId!=='string'||frame.messageId.length<12))return false;
  if(frame.kind==='text'&&(typeof frame.messageId!=='string'||frame.messageId.length<12||
     typeof frame.text!=='string'||frame.text.length>2048))return false;
  this.lastSequence=frame.seq;
  if(frame.kind==='clear_end'){this.ended=true;this.onClearEnd();}
  else if(frame.kind==='end'){this.ended=true;this.onEnd();}
  else if(frame.kind==='security_fail'){this.ended=true;this.onSecurityFailure('Peer device security requirements not satisfied.');}
  else if(frame.kind==='seen')this.onSeen(frame.messageId);
  else if(frame.kind==='text')this.onText(frame.messageId,frame.text);
  return true;
 }
 end(){this.ended=true;}
}
module.exports={SecureControl};
