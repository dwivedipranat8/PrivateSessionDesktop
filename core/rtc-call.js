'use strict';
/**
 * WebRTC DTLS-SRTP call engine, usable from the sandboxed Electron renderer.
 *
 * SECURITY PRECONDITION: The signalling adapter MUST be a previously
 * authenticated/pinned Noise E2EE stream. No unauthenticated WSS/room signalling
 * is accepted. Constructing this class alone does not create that stream.
 *
 * Every SDP/fingerprint/ICE frame is bound to session and approved device.
 * No text DataChannel is created; text/control must use authenticated Noise.
 * ICE relay-only prevents peer-to-peer candidate fallback, but needs temporary
 * TURN credentials supplied securely after enrollment.
 */
(function init(root){
 const MAX_SDP=64000,MAX_ICE=8192;
 function requireId(v){return typeof v==='string'&&v.length>=12&&v.length<=150&&/^[A-Za-z0-9_-]+$/.test(v);}
 function isOffer(o,type){return o&&o.type===type&&typeof o.sdp==='string'&&
   o.sdp.length>20&&o.sdp.length<=MAX_SDP&&o.sdp.includes('a=fingerprint:');}
 function peerFrame(frame,sessionId,peerId,lastSeq){
  return frame&&frame.sessionId===sessionId&&frame.senderDevice===peerId&&
    Number.isSafeInteger(frame.seq)&&frame.seq===lastSeq+1;
 }
 class RTCCall {
  constructor({sessionId,localDeviceId,peerDeviceId,sendAuthenticated,onRemoteMedia,onStop,
   rtcCtor,certificateFactory,role='protected'}={}){
   if(!requireId(sessionId)||!requireId(localDeviceId)||!requireId(peerDeviceId)||
      localDeviceId===peerDeviceId)throw Error('Pinned session and both devices required');
   if(typeof sendAuthenticated!=='function')throw Error('Authenticated Noise transport required');
   if(!['host','protected'].includes(role))throw Error('Explicit role required');
   this.role=role;
   this.sessionId=sessionId;this.localDeviceId=localDeviceId;this.peerDeviceId=peerDeviceId;
   this.send=sendAuthenticated;
   this.onRemoteMedia=onRemoteMedia||(()=>{});this.onStop=onStop||(()=>{});
   this.RTC=rtcCtor||root.RTCPeerConnection;
   this.certificateFactory=certificateFactory||this.RTC?.generateCertificate?.bind(this.RTC);
   this.pc=null;this.localStream=null;this.pendingCandidates=[];this.lastReceivedSeq=0;this.nextSeq=1;
   this.closed=false;this.ready=false;this.preparing=false;this.incomingQueue=Promise.resolve();
  }
  async prepare({localStream=null,iceServers,initiator=false}={}){
   if(this.closed||this.pc||this.preparing)throw Error('Session cannot be reused or prepared twice');
   this.preparing=true;
   // Take responsibility for tracks *before* any asynchronous certificate
   // operation. end() can stop the tracks during that await.
   this.localStream=localStream;
   try{
    const video=localStream?.getVideoTracks?.()||[];
    const audio=localStream?.getAudioTracks?.()||[];
    if(this.role==='protected'&&(!video.some(t=>t.readyState==='live')||
       !audio.some(t=>t.readyState==='live')))
     throw Error('Protected participant must enable camera and microphone');
    if(localStream&&!Array.isArray(localStream.getTracks?.()))
     throw Error('Invalid captured media stream');
    if(!Array.isArray(iceServers)||iceServers.length===0||
       iceServers.some(s=>{
        const urls=Array.isArray(s?.urls)?s.urls:[s?.urls];
        return urls.length===0||urls.some(u=>typeof u!=='string'||!/^turns?:/i.test(u))||
          typeof s.username!=='string'||!s.username||
          typeof s.credential!=='string'||!s.credential;
       }))throw Error('Temporary TURN credentials required; STUN/direct fallback forbidden');
    if(!this.RTC||!this.certificateFactory)throw Error('Secure WebRTC unavailable');
    const certificate=await this.certificateFactory({name:'ECDSA',namedCurve:'P-256'});
    if(this.closed)throw Error('Media setup cancelled');
    this.pc=new this.RTC({iceTransportPolicy:'relay',iceServers,certificates:[certificate],
       bundlePolicy:'max-bundle',rtcpMuxPolicy:'require',iceCandidatePoolSize:0});
    if(localStream)for(const track of localStream.getTracks())this.pc.addTrack(track,localStream);
    // The Host may receive media without granting its camera/mic.
    if(this.role==='host'){
     if(!video.some(t=>t.readyState==='live'))this.pc.addTransceiver('video',{direction:'recvonly'});
     if(!audio.some(t=>t.readyState==='live'))this.pc.addTransceiver('audio',{direction:'recvonly'});
    }
    this.pc.ontrack=e=>{if(!this.closed)this.onRemoteMedia(e.streams,e.track);};
    this.pc.ondatachannel=e=>{try{e.channel?.close();}catch{}};
    this.pc.onicecandidate=e=>{
     if(!this.closed&&e.candidate)
       this.sendFrame({kind:'candidate',candidate:e.candidate.toJSON?.()||e.candidate})
         .catch(()=>this.end('Signalling failed'));
    };
    this.pc.onconnectionstatechange=()=>{
     const state=this.pc?.connectionState;
     if(state==='failed'||state==='disconnected'||state==='closed')this.end('Media connection lost');
     if(state==='connected')this.ready=true;
    };
    if(initiator){
     const offer=await this.pc.createOffer();
     if(this.closed)throw Error('Media setup cancelled');
     await this.pc.setLocalDescription(offer);
     if(this.closed)throw Error('Media setup cancelled');
     await this.sendFrame({kind:'offer',sdp:offer.sdp});
     if(this.closed)throw Error('Media setup cancelled');
    }
    return true;
   }catch(err){
    this.end('Media preparation failed');
    throw err;
   }finally{this.preparing=false;}
  }
  async flushCandidates(){
   if(!this.pc?.remoteDescription)return;
   const awaiting=this.pendingCandidates;
   this.pendingCandidates=[];
   for(const candidate of awaiting)await this.pc.addIceCandidate(candidate);
  }
  async sendFrame(payload){
   if(this.closed)throw Error('Session closed');
   // No remote media setup is permitted outside the pinned encrypted channel.
   const envelope={...payload,sessionId:this.sessionId,senderDevice:this.localDeviceId,seq:this.nextSeq++};
   const delivered=await this.send(envelope);
   if(delivered===false||this.closed)throw Error('Encrypted signalling delivery unavailable');
  }
  async acceptSignal(envelope,{fromAuthenticatedPinnedNoisePeer=false}={}){
   if(this.closed||!this.pc||fromAuthenticatedPinnedNoisePeer!==true)return false;
   // Stream handlers can run concurrently. All offers/ICE candidates must
   // be processed strictly in authenticated incoming sequence order.
   const task=this.incomingQueue.then(()=>
     this.processSignal(envelope,{fromAuthenticatedPinnedNoisePeer}));
   this.incomingQueue=task.catch(()=>{});
   return task;
  }
  async processSignal(envelope,{fromAuthenticatedPinnedNoisePeer=false}={}){
   if(this.closed||!this.pc||fromAuthenticatedPinnedNoisePeer!==true)return false;
   if(!peerFrame(envelope,this.sessionId,this.peerDeviceId,this.lastReceivedSeq))return false;
   if(!['offer','answer','candidate','end'].includes(envelope.kind))return false;
   try{
     if(envelope.kind==='offer'){
       if(this.pc.signalingState!=='stable'||!isOffer({type:'offer',sdp:envelope.sdp},'offer'))return false;
       await this.pc.setRemoteDescription({type:'offer',sdp:envelope.sdp});
       if(this.closed)return false;
       await this.flushCandidates();
       const answer=await this.pc.createAnswer();
       await this.pc.setLocalDescription(answer);
       if(this.closed)return false;
       await this.sendFrame({kind:'answer',sdp:answer.sdp});
     }else if(envelope.kind==='answer'){
       if(this.pc.signalingState!=='have-local-offer'||!isOffer({type:'answer',sdp:envelope.sdp},'answer'))return false;
       await this.pc.setRemoteDescription({type:'answer',sdp:envelope.sdp});
       if(this.closed)return false;
       await this.flushCandidates();
     }else if(envelope.kind==='candidate'){
       const c=envelope.candidate;
       if(!c||typeof c.candidate!=='string'||c.candidate.length>MAX_ICE)return false;
       if(!this.pc.remoteDescription){
         if(this.pendingCandidates.length>=32){this.end('Too many early candidates');return false;}
         this.pendingCandidates.push(c);
       }else{
         await this.pc.addIceCandidate(c);
       }
     }else if(envelope.kind==='end'){
       this.end('Peer ended');
     }
     if(this.closed&&envelope.kind!=='end')return false;
     this.lastReceivedSeq=envelope.seq;return true;
   }catch{this.end('Invalid authenticated media setup');return false;}
  }
  end(reason='Ended'){
   if(this.closed)return;
   this.closed=true;this.ready=false;
   const pc=this.pc,stream=this.localStream;
   // Release references before invoking callbacks that may throw.
   this.pc=null;this.localStream=null;this.pendingCandidates=[];
   try{
    if(pc){
     pc.ontrack=null;pc.onicecandidate=null;pc.onconnectionstatechange=null;
     try{pc.close();}catch{}
    }
   }catch{}
   try{
    // Attempt every track even when one track's stop handler fails.
    for(const track of stream?.getTracks?.()||[]){try{track.stop();}catch{}}
   }catch{}
   try{this.onRemoteMedia([],null);}catch{}
   try{this.onStop(reason);}catch{}
  }
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={RTCCall};
 else root.RTCCall=RTCCall;
})(typeof window!=='undefined'?window:globalThis);
