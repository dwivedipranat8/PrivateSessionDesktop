'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {SecureSessionCoordinator}=require('../core/secure-session-coordinator.cjs');
const ID='secure_session_abc123',PEER='approved_peer_9876543';
function rig(){
 let now=1000,n=0;
 const events=[],outgoing=[];
 let flags={network:true,volume:true,camera:true,microphone:true,trust:true,captureProtectionVerified:true,accountLease:true};
 const session=new SecureSessionCoordinator({
  sessionId:ID,remotePeerId:PEER,clock:()=>now,
  random:()=>('random-number-'+(++n)).padEnd(24,'x'),
  guards:()=>flags,sendNoise:frame=>{outgoing.push(frame);},
  hide:()=>events.push('cover'),stopMedia:()=>events.push('sensors-stop'),
  clearChat:()=>events.push('clear'),destroyEphemeralKeys:()=>events.push('keys'),
  closeTransport:()=>events.push('transport'),closeWindow:()=>events.push('window')
 });
 return {session,events,outgoing,wait:d=>{now+=d;},flags:(name,value)=>{flags[name]=value;}};
}
test('no private content until an authenticated pinned peer replies',async()=>{
 const r=rig();await r.session.tick();
 assert.equal(r.session.canDisplay,false);
 const challenge=r.outgoing[0];
 assert.ok(challenge);
 const answer={kind:'response',sessionId:ID,token:challenge.token};
 assert.equal(await r.session.fromPinnedNoise(answer,{authenticatedRemotePeerId:'wrong-peer-11111111'}),false);
 assert.equal(r.session.canDisplay,false);
 assert.equal(await r.session.fromPinnedNoise(answer,{authenticatedRemotePeerId:PEER}),true);
 assert.equal(r.session.canDisplay,true);
});
test('local USB removal clears/ends without awaiting peer',async()=>{
 const r=rig();await r.session.tick();
 const proof=r.outgoing[0];
 await r.session.fromPinnedNoise({kind:'response',sessionId:ID,token:proof.token},{authenticatedRemotePeerId:PEER});
 r.flags('volume',false);await r.session.tick();
 assert.equal(r.session.canDisplay,false);
 assert.deepEqual(r.events,['cover','sensors-stop','clear','keys','transport','window']);
 r.session.fail('repeat');assert.equal(r.events.length,6);
});
test('3sec protect and 5sec expire, no reopening after delayed response',async()=>{
 const r=rig();await r.session.tick();const first=r.outgoing[0];
 await r.session.fromPinnedNoise({kind:'response',sessionId:ID,token:first.token},{authenticatedRemotePeerId:PEER});
 r.wait(3000);await r.session.tick();assert.equal(r.session.phase,'protected');
 assert.equal(r.session.canDisplay,false);assert.deepEqual(r.events,['cover','sensors-stop','clear']);
 r.wait(2000);await r.session.tick();assert.equal(r.session.phase,'expired');
 assert.equal(await r.session.fromPinnedNoise({kind:'response',sessionId:ID,token:first.token},{authenticatedRemotePeerId:PEER}),false);
});
test('unauthenticated network disconnect triggers teardown',async()=>{
 const r=rig();r.flags('network',false);await r.session.tick();
 assert.equal(r.session.phase,'expired');
 assert.equal(r.outgoing.length,0);
 assert.deepEqual(r.events,['cover','sensors-stop','clear','keys','transport','window']);
});

test('host needs no camera, microphone or removable USB',()=>{
 const host=new SecureSessionCoordinator({sessionId:ID,remotePeerId:PEER,clock:()=>100,
  guards:()=>({network:true,trust:true,accountLease:true}),
  sendNoise:async()=>{},hide:()=>{},stopMedia:()=>{},clearChat:()=>{},
  destroyEphemeralKeys:()=>{},closeTransport:()=>{},closeWindow:()=>{},role:'host'});
 assert.equal(host.healthyGuards(),true);
 const protectedRole=rig();
 protectedRole.flags('camera',false);assert.equal(protectedRole.session.healthyGuards(),false);
});
test('definitive USB/network event fails immediately without waiting for tick',()=>{
 const r=rig();r.session.onDefinitiveLoss('usb');
 assert.equal(r.session.phase,'expired');
 assert.deepEqual(r.events,['cover','sensors-stop','clear','keys','transport','window']);
});

test('authenticated heartbeat is insufficient when account lease is revoked',async()=>{
 const r=rig();
 await r.session.tick();
 const fresh=r.outgoing[0];
 await r.session.fromPinnedNoise({kind:'response',sessionId:ID,token:fresh.token},{authenticatedRemotePeerId:PEER});
 assert.equal(r.session.canDisplay,true);
 r.flags('accountLease',false);
 assert.equal(r.session.canDisplay,false);
 await r.session.tick();
 assert.equal(r.session.phase,'expired');
});
test('late peer response cannot restore session if timer callback is stalled',async()=>{
 const r=rig();await r.session.tick();
 const first=r.outgoing[0];
 await r.session.fromPinnedNoise({kind:'response',sessionId:ID,token:first.token},{authenticatedRemotePeerId:PEER});
 r.wait(2500);await r.session.tick();
 const second=r.outgoing.at(-1);
 r.wait(600);
 assert.equal(await r.session.fromPinnedNoise({kind:'response',sessionId:ID,token:second.token},{authenticatedRemotePeerId:PEER}),false);
 assert.equal(r.session.canDisplay,false);
});
