'use strict';
/**
 * WebRTC DTLS-SRTP call engine, usable from the sandboxed Electron renderer.
 *
 * SECURITY PRECONDITION: The signalling adapter MUST be a previously
 * authenticated/pinned Noise E2EE stream. No unauthenticated WSS/room signalling
 * is accepted. Constructing this class alone does not create that stream.
 *
 * Every SDP/fingerprint/ICE frame is bound to session and approved device.
 * ICE relay-only prevents peer-to-peer candidate fallback, but needs temporary
 * TURN credentials supplied securely after enrollment.
 */
(function init(root){
 const MAX_SDP=64000,MAX_ICE=8192,MAX_TEXT=2048;
 function requireId(v){return typeof v==='string'&&v.length>=12&&v.length<=150&&/^[A-Za-z0-9_-]+$/.test(v);}
 function isOffer(o,type){return o&&o.type===type&&typeof o.sdp==='string'&&
   o.sdp.length>20&&o.sdp.length<=MAX_SDP&&o.sdp.includes('a=fingerprint:');}
 function peerFrame(frame,sessionId,peerId,lastSeq){
  return frame&&frame.sessionId===sessionId&&frame.senderDevice===peerId&&
    Number.isSafeInteger(frame.seq)&&frame.seq>lastSeq&&frame.seq<=Number.MAX_SAFE_INTEGER;
 }
 class RTCCall {
  constructor({sessionId,localDeviceId,peerDeviceId,sendAuthenticated,onMessage,onRemoteMedia,onStop,
   rtcCtor,certificateFactory}={}){
   if(!requireId(sessionId)||!requireId(localDeviceId)||!requireId(peerDeviceId)||
      localDeviceId===peerDeviceId)throw Error('Pinned session and both devices required');
   if(typeof sendAuthenticated!=='function')throw Error('Authenticated Noise transport required');
   this.sessionId=sessionId;this.localDeviceId=localDeviceId;this.peerDeviceId=peerDeviceId;
   this.send=sendAuthenticated;this.onMessage=onMessage||(()=>{});
   this.onRemoteMedia=onRemoteMedia||(()=>{});this.onStop=onStop||(()=>{});
   this.RTC=rtcCtor||root.RTCPeerConnection;
   this.certificateFactory=certificateFactory||this.RTC?.generateCertificate?.bind(this.RTC);
   this.pc=null;this.channel=null;this.localStream=null;this.lastReceivedSeq=0;this.nextSeq=1;
   this.closed=false;this.ready=false;
  }
  async prepare({localStream,iceServers,initiator=false}={}){
   if(this.closed||this.pc)throw Error('Session cannot be reused');
   if(!localStream||!localStream.getVideoTracks?.().some(t=>t.readyState==='live')||
     !localStream.getAudioTracks?.().some(t=>t.readyState==='live'))throw Error('Camera and mic required');
   if(!Array.isArray(iceServers)||iceServers.length===0||
     iceServers.some(s=>!s.urls||!/turns?:/.test(Array.isArray(s.urls)?s.urls.join(' '):s.urls)))
     throw Error('TURN servers required; STUN-only/direct is forbidden');
   if(!this.RTC||!this.certificateFactory)throw Error('Secure WebRTC unavailable');
   const certificate=await this.certificateFactory({name:'ECDSA',namedCurve:'P-256'});
   if(this.closed)throw Error('Session already ended');
   this.pc=new this.RTC({iceTransportPolicy:'relay',iceServers,certificates:[certificate],
      bundlePolicy:'max-bundle',rtcpMuxPolicy:'require',iceCandidatePoolSize:0});
   this.localStream=localStream;
   for(const track of localStream.getTracks())this.pc.addTrack(track,localStream);
   this.pc.ontrack=e=>{if(!this.closed)this.onRemoteMedia(e.streams,e.track);};
   this.pc.onicecandidate=e=>{
    if(!this.closed&&e.candidate){
      this.sendFrame({kind:'candidate',candidate:e.candidate.toJSON?.()||e.candidate}).catch(()=>this.end('Signalling failed'));
    }
   };
   this.pc.onconnectionstatechange=()=>{
    const state=this.pc?.connectionState;
    if(state==='failed'||state==='disconnected'||state==='closed')this.end('Media connection lost');
    if(state==='connected')this.ready=true;
   };
   if(initiator){
     const dc=this.pc.createDataChannel('chat',{ordered:true});
     this.setupData(dc);
     const offer=await this.pc.createOffer();
     await this.pc.setLocalDescription(offer);
     await this.sendFrame({kind:'offer',sdp:offer.sdp});
   }else{
     this.pc.ondatachannel=e=>{
       if(this.closed||e.channel.label!=='chat'){e.channel.close();return;}
       this.setupData(e.channel);
     };
   }
   return true;
  }
  setupData(dc){
   this.channel=dc;
   dc.onmessage=e=>{
    if(this.closed||!this.ready||typeof e.data!=='string'||e.data.length>MAX_TEXT)return;
    this.onMessage(e.data);
   };
   dc.onclose=()=>{if(!this.closed)this.end('Text connection lost');};
  }
  async sendFrame(payload){
   if(this.closed)throw Error('Session closed');
   // No remote media setup is permitted outside the pinned encrypted channel.
   const envelope={...payload,sessionId:this.sessionId,senderDevice:this.localDeviceId,seq:this.nextSeq++};
   await this.send(envelope);
  }
  async acceptSignal(envelope,{fromAuthenticatedPinnedNoisePeer=false}={}){
   if(this.closed||!this.pc||fromAuthenticatedPinnedNoisePeer!==true)return false;
   if(!peerFrame(envelope,this.sessionId,this.peerDeviceId,this.lastReceivedSeq))return false;
   if(!['offer','answer','candidate','end'].includes(envelope.kind))return false;
   try{
     if(envelope.kind==='offer'){
       if(this.pc.signalingState!=='stable'||!isOffer({type:'offer',sdp:envelope.sdp},'offer'))return false;
       await this.pc.setRemoteDescription({type:'offer',sdp:envelope.sdp});
       const answer=await this.pc.createAnswer();
       await this.pc.setLocalDescription(answer);
       await this.sendFrame({kind:'answer',sdp:answer.sdp});
     }else if(envelope.kind==='answer'){
       if(this.pc.signalingState!=='have-local-offer'||!isOffer({type:'answer',sdp:envelope.sdp},'answer'))return false;
       await this.pc.setRemoteDescription({type:'answer',sdp:envelope.sdp});
     }else if(envelope.kind==='candidate'){
       const c=envelope.candidate;
       if(!c||typeof c.candidate!=='string'||c.candidate.length>MAX_ICE||
         !this.pc.remoteDescription)return false;
       await this.pc.addIceCandidate(c);
     }else if(envelope.kind==='end'){
       this.end('Peer ended');
     }
     this.lastReceivedSeq=envelope.seq;return true;
   }catch{this.end('Invalid authenticated media setup');return false;}
  }
  sendText(text){
   if(this.closed||!this.ready||this.channel?.readyState!=='open'||typeof text!=='string'||
      text.length>MAX_TEXT)return false;
   this.channel.send(text);return true;
  }
  end(reason='Ended'){
   if(this.closed)return;
   this.closed=true;this.ready=false;
   try{this.channel?.close();}catch{}
   try{if(this.pc){this.pc.ontrack=null;this.pc.onicecandidate=null;this.pc.onconnectionstatechange=null;this.pc.close();}}catch{}
   // Caller is responsible for the shared capture stream; close it on every end.
   try{this.localStream?.getTracks().forEach(t=>t.stop());}catch{}
   this.onRemoteMedia([],null);this.onStop(reason);
   this.pc=null;this.localStream=null;this.channel=null;
  }
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={RTCCall};
 else root.RTCCall=RTCCall;
})(typeof window!=='undefined'?window:globalThis);
