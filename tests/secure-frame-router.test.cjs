'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {SecureFrameRouter}=require('../core/secure-frame-router.cjs');
const {SecureControl}=require('../core/secure-control.cjs');
const SID='secure_session_0123456789',A='12D3KooWApprovedSender1234567890',B='12D3KooWApprovedReceiver123456789';
function rig(){
 const encrypted=[],results=[],fail=[];
 const control=new SecureControl({sessionId:SID,approvedRemoteDevice:B,
  hostDeviceId:A,localDeviceId:A,onText:(_id,value)=>results.push('text:'+value)});
 const route=new SecureFrameRouter({sessionId:SID,localPeerId:A,remotePeerId:B,
  sendAuthenticated:async frame=>{encrypted.push(frame);return true;},
  onControl:(frame,meta)=>control.receive(frame,meta),
  onHeartbeat:async frame=>{results.push('heartbeat:'+frame.kind);return true;},
  onRtc:async frame=>{results.push('rtc:'+frame.kind);return true;},
  onFailure:r=>fail.push(r)});
 return {route,encrypted,results,fail};
}
const mk=(channel,seq,kind,more={})=>({version:1,channel,seq,kind,sender:B,
  sessionId:SID,payload:{kind,...more}});
test('one Noise-pinned identity routes interleaved text, heartbeat and RTC sequences',async()=>{
 const r=rig();
 const m='message_0123456789';
 assert.equal(await r.route.receive(mk('control',1,'text',{messageId:m,text:'dummy'}),{noiseRemotePeerId:B}),true);
 assert.equal(await r.route.receive(mk('heartbeat',2,'challenge',{token:'12345678901234567890'}),{noiseRemotePeerId:B}),true);
 assert.equal(await r.route.receive(mk('rtc',3,'candidate',{candidate:{candidate:'dummy'}}),{noiseRemotePeerId:B}),true);
 assert.deepEqual(r.results,['text:dummy','heartbeat:challenge','rtc:candidate']);
 assert.equal(r.route.receivedSequence,3);
});
test('unverified transport peer and replay trigger irreversible fail-closed',async()=>{
 const r=rig(),msg=mk('heartbeat',1,'response',{token:'12345678901234567890'});
 assert.equal(await r.route.receive(msg,{noiseRemotePeerId:'unapproved_01234567890'}),false);
 assert.equal(await r.route.receive(msg,{noiseRemotePeerId:B}),false);
 assert.equal(r.fail.length,1);
});
test('sending one versioned authenticated envelope never sends media as cleartext',async()=>{
 const r=rig();
 assert.equal(await r.route.send('rtc',{kind:'offer',sdp:'DUMMY SDP'}),true);
 assert.deepEqual({version:r.encrypted[0].version,channel:r.encrypted[0].channel,
  sender:r.encrypted[0].sender,seq:r.encrypted[0].seq},{version:1,channel:'rtc',sender:A,seq:1});
 assert.equal(await r.route.send('control',{kind:'text',text:'dummy',messageId:'message_012345'}),true);
 assert.equal(r.encrypted[1].seq,2);
});
test('RTC-sized SDP permitted without arbitrary tiny 8192-byte frame limit',async()=>{
 const r=rig();
 assert.equal(await r.route.send('rtc',{kind:'offer',sdp:'s'.repeat(60000)}),true);
 assert.equal(r.encrypted.length,1);
 assert.equal(await r.route.send('rtc',{kind:'offer',sdp:'x'.repeat(120000)}),false);
 assert.equal(r.route.closed,true);
});
test('bad async session handler response fails close and never resumes',async()=>{
 const r=rig(),m=mk('control',1,'delete');
 // This untrusted sender is not the Host, so host-only Delete must be refused.
 assert.equal(await r.route.receive(m,{noiseRemotePeerId:B}),false);
 assert.equal(r.route.closed,true);
 assert.equal(await r.route.send('heartbeat',{kind:'challenge',token:'12345678901234567890'}),false);
});

test('stalled RTC handler cannot hold up heartbeat and authenticated End',async()=>{
 let finishRtc;const delivered=[],fail=[];
 const route=new SecureFrameRouter({sessionId:SID,localPeerId:A,remotePeerId:B,
   sendAuthenticated:async()=>true,
   onControl:async frame=>{delivered.push('control:'+frame.kind);return true;},
   onHeartbeat:async frame=>{delivered.push('heartbeat:'+frame.kind);return true;},
   onRtc:async()=>new Promise(resolve=>{finishRtc=resolve;}),
   onFailure:why=>fail.push(why)});
 assert.equal(await route.receive(mk('rtc',1,'offer',{sdp:'DUMMY'}),{noiseRemotePeerId:B}),true);
 // Start the asynchronous RTC handler without waiting on it.
 await Promise.resolve();await Promise.resolve();
 const safe=await Promise.race([
   Promise.all([
    route.receive(mk('heartbeat',2,'response',{token:'12345678901234567890'}),{noiseRemotePeerId:B}),
    route.receive(mk('control',3,'end'),{noiseRemotePeerId:B})
   ]),new Promise((_r,reject)=>setTimeout(()=>reject(Error('Heartbeat/End was blocked by RTC')),200))
 ]);
 assert.deepEqual(safe,[true,true]);
 assert.deepEqual(delivered,['heartbeat:response','control:end']);
 finishRtc(true);await route.rtcProcessing;
 assert.deepEqual(fail,[]);
});
test('rejected asynchronous RTC action eventually refuses further session traffic',async()=>{
 const fail=[];
 const r=new SecureFrameRouter({sessionId:SID,localPeerId:A,remotePeerId:B,
  sendAuthenticated:async()=>true,onControl:async()=>true,onHeartbeat:async()=>true,
  onRtc:async()=>false,onFailure:why=>fail.push(why)});
 assert.equal(await r.receive(mk('rtc',1,'offer'),{noiseRemotePeerId:B}),true);
 await r.rtcProcessing;
 assert.equal(r.closed,true);
 assert.equal(await r.receive(mk('heartbeat',2,'challenge'),{noiseRemotePeerId:B}),false);
 assert.equal(fail.length,1);
});
