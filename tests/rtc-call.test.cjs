'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {RTCCall}=require('../core/rtc-call.js');
const SESSION='verified_session_101',LOCAL='approved_local_01',PEER='approved_peer_02';
function media(){const video={kind:'video',readyState:'live',stop(){this.readyState='ended';}},
 audio={kind:'audio',readyState:'live',stop(){this.readyState='ended';}};
 return {getTracks:()=>[video,audio],getVideoTracks:()=>[video],getAudioTracks:()=>[audio]};}
function fake(){
 const made=[];
 class RTC{
   static async generateCertificate(){return {dummy:true};}
   constructor(configuration){this.configuration=configuration;this.signalingState='stable';this.connectionState='new';this.remoteDescription=null;made.push(this);}
   addTrack(){}
   createDataChannel(){return {label:'chat',readyState:'open',send(){},close(){}};}
   async createOffer(){return {type:'offer',sdp:'v=0\n'+'a=fingerprint:sha-256 11:22:33\n'+'x'.repeat(40)};}
   async createAnswer(){return {type:'answer',sdp:'v=0\n'+'a=fingerprint:sha-256 11:22:33\n'+'x'.repeat(40)};}
   async setLocalDescription(o){this.signalingState=o.type==='offer'?'have-local-offer':'stable';}
   async setRemoteDescription(o){this.remoteDescription=o;this.signalingState=o.type==='offer'?'have-remote-offer':'stable';}
   async addIceCandidate(c){this.candidates??=[];this.candidates.push(c);}
   close(){this.connectionState='closed';}
 }
 return {RTC,made};
}
test('TURN-only media, fresh certificate and explicitly approved local tracks',async()=>{
 const f=fake(),s=media(),sent=[],call=new RTCCall({sessionId:SESSION,localDeviceId:LOCAL,peerDeviceId:PEER,
 sendAuthenticated:e=>{sent.push(e);},rtcCtor:f.RTC});
 await call.prepare({localStream:s,iceServers:[{urls:'turns:relay.example.org:5349',username:'temp',credential:'temp'}],initiator:true});
 assert.equal(f.made[0].configuration.iceTransportPolicy,'relay');
 assert.equal(typeof f.made[0].ondatachannel,'undefined');
 assert.equal(sent[0].kind,'offer');assert.equal(sent[0].sessionId,SESSION);
 call.end();assert.equal(s.getTracks().every(t=>t.readyState==='ended'),true);
});
test('reject unauthenticated or wrong peer/session SDP',async()=>{
 const f=fake(),sent=[],call=new RTCCall({sessionId:SESSION,localDeviceId:LOCAL,peerDeviceId:PEER,
 sendAuthenticated:e=>{sent.push(e);},rtcCtor:f.RTC});
 await call.prepare({localStream:media(),iceServers:[{urls:'turn:relay.example.org:3478',username:'temp',credential:'temp'}]});
 const e={kind:'offer',sessionId:SESSION,senderDevice:PEER,seq:1,sdp:'v=0\na=fingerprint:sha-256 FF\n'};
 assert.equal(await call.acceptSignal(e),false);
 assert.equal(await call.acceptSignal({...e,senderDevice:'attacker_7777777'},{fromAuthenticatedPinnedNoisePeer:true}),false);
 assert.equal(await call.acceptSignal({...e,sessionId:'other_session_88888'},{fromAuthenticatedPinnedNoisePeer:true}),false);
 call.end();
});
test('reject STUN-only and no camera or mic',async()=>{
 const f=fake(),c=new RTCCall({sessionId:SESSION,localDeviceId:LOCAL,peerDeviceId:PEER,
 sendAuthenticated:async()=>{},rtcCtor:f.RTC});
 await assert.rejects(c.prepare({localStream:media(),iceServers:[{urls:'stun:only.example.org'}]}));
 await assert.rejects(c.prepare({localStream:{getVideoTracks:()=>[],getAudioTracks:()=>[]},iceServers:[{urls:'turn:relay.example.org'}]}));
});
test('wrong session cannot send plaintext without active authenticated channel',()=>{
 const f=fake(),c=new RTCCall({sessionId:SESSION,localDeviceId:LOCAL,peerDeviceId:PEER,
 sendAuthenticated:async()=>{},rtcCtor:f.RTC});
 assert.equal(typeof c.sendText,'undefined');c.end();
});

test('cannot pass STUN URL concealed inside a mixed TURN list',async()=>{
 const f=fake(),c=new RTCCall({sessionId:SESSION,localDeviceId:LOCAL,peerDeviceId:PEER,
   sendAuthenticated:async()=>{},rtcCtor:f.RTC});
 await assert.rejects(c.prepare({localStream:media(),iceServers:[
  {urls:['turn:relay.example.org:3478','stun:insecure.example.org'],username:'temp',credential:'temp'}]}));
});
test('out-of-order authenticated session frames do not advance sequence',async()=>{
 const f=fake(),c=new RTCCall({sessionId:SESSION,localDeviceId:LOCAL,peerDeviceId:PEER,
   sendAuthenticated:async()=>{},rtcCtor:f.RTC});
 await c.prepare({localStream:media(),iceServers:[{urls:'turns:relay.example.org:5349',username:'temp',credential:'temp'}]});
 const frame={kind:'end',sessionId:SESSION,senderDevice:PEER,seq:4};
 assert.equal(await c.acceptSignal(frame,{fromAuthenticatedPinnedNoisePeer:true}),false);
 assert.equal(await c.acceptSignal({...frame,seq:1},{fromAuthenticatedPinnedNoisePeer:true}),true);
});

test('early ICE candidates are bounded and flushed when pinned offer arrives',async()=>{
 const f=fake(),c=new RTCCall({sessionId:SESSION,localDeviceId:LOCAL,peerDeviceId:PEER,
  sendAuthenticated:async()=>{},rtcCtor:f.RTC});
 await c.prepare({localStream:media(),iceServers:[{urls:'turns:relay.example.org:5349',username:'temp',credential:'temp'}]});
 const early={kind:'candidate',sessionId:SESSION,senderDevice:PEER,seq:1,candidate:{candidate:'candidate:mock'}};
 assert.equal(await c.acceptSignal(early,{fromAuthenticatedPinnedNoisePeer:true}),true);
 assert.equal(c.pendingCandidates.length,1);
 const offer={kind:'offer',sessionId:SESSION,senderDevice:PEER,seq:2,
  sdp:'v=0\na=fingerprint:sha-256 11:22:33\n'+'x'.repeat(30)};
 assert.equal(await c.acceptSignal(offer,{fromAuthenticatedPinnedNoisePeer:true}),true);
 assert.equal(c.pendingCandidates.length,0);
 assert.equal(f.made[0].candidates?.length,1);
 c.end();
});
test('incoming RTC data channels are forcibly closed, including on caller',async()=>{
 const f=fake(),c=new RTCCall({sessionId:SESSION,localDeviceId:LOCAL,peerDeviceId:PEER,
  sendAuthenticated:async()=>{},rtcCtor:f.RTC});
 await c.prepare({localStream:media(),iceServers:[{urls:'turn:relay.example.org',username:'temp',credential:'temp'}],initiator:true});
 let closed=false;f.made[0].ondatachannel({channel:{close(){closed=true;}}});
 assert.equal(closed,true);c.end();
});
