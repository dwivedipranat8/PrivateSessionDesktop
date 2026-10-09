'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {SecureControl}=require('../core/secure-control.cjs');
const sessionId='session_0123456789',approvedRemoteDevice='approved_peer_01';
function rig(){
 const events=[];
 const c=new SecureControl({sessionId,approvedRemoteDevice,hostDeviceId:'my-device-01',
  localDeviceId:'my-device-01',onClearEnd:()=>events.push('clear_end'),
  onEnd:()=>events.push('end'),onSeen:id=>events.push('seen:'+id)});
 return {c,events};
}
test('approved Protected participant can Clear & End',()=>{
 const r=rig(),frame={kind:'clear_end',sessionId,sender:approvedRemoteDevice,seq:1,requestId:'secure_clear_req_12345'};
 assert.equal(r.c.receive(frame,{noiseRemoteDeviceId:'attacker-device'}),false);
 assert.equal(r.c.receive(frame,{noiseRemoteDeviceId:approvedRemoteDevice}),true);
 assert.deepEqual(r.events,['clear_end']);
 assert.equal(r.c.receive({...frame,seq:2},{noiseRemoteDeviceId:approvedRemoteDevice}),false);
});
test('wrong session/seq or legacy Delete refused',()=>{
 const r=rig(),frame={kind:'clear_end',sessionId,sender:approvedRemoteDevice,seq:2,requestId:'secure_clear_req_12345'};
 assert.equal(r.c.receive(frame,{noiseRemoteDeviceId:approvedRemoteDevice}),false);
 assert.equal(r.c.receive({...frame,seq:1,sessionId:'other_session_1234'},{noiseRemoteDeviceId:approvedRemoteDevice}),false);
 assert.equal(r.c.receive({...frame,kind:'delete',seq:1},{noiseRemoteDeviceId:approvedRemoteDevice}),false);
});
test('authenticated Seen must be sequential and from correct session',()=>{
 const r=rig(),receipt={kind:'seen',sessionId,sender:approvedRemoteDevice,seq:1,messageId:'message_0123456'};
 assert.equal(r.c.receive({...receipt,sessionId:'other_session_1234'},{noiseRemoteDeviceId:approvedRemoteDevice}),false);
 assert.equal(r.c.receive(receipt,{noiseRemoteDeviceId:approvedRemoteDevice}),true);
 assert.deepEqual(r.events,['seen:message_0123456']);
 assert.equal(r.c.receive({...receipt,seq:3},{noiseRemoteDeviceId:approvedRemoteDevice}),false);
});
test('End prevents later text',()=>{
 const r=rig(),frame={kind:'end',sessionId,sender:approvedRemoteDevice,seq:1};
 assert.equal(r.c.receive(frame,{noiseRemoteDeviceId:approvedRemoteDevice}),true);
 assert.equal(r.c.receive({...frame,seq:2,kind:'text',messageId:'message_0123456',text:'late'},{noiseRemoteDeviceId:approvedRemoteDevice}),false);
 assert.deepEqual(r.events,['end']);
});

test('Clear & End cannot be triggered with a malformed requestId',()=>{
 const r=rig(),frame={kind:'clear_end',sessionId,sender:approvedRemoteDevice,seq:1,requestId:'short'};
 assert.equal(r.c.receive(frame,{noiseRemoteDeviceId:approvedRemoteDevice}),false);
 assert.deepEqual(r.events,[]);
});
test('acknowledgement of remote clear is accepted only from pinned peer',()=>{
 const events=[];
 const c=new SecureControl({sessionId,approvedRemoteDevice,hostDeviceId:'my-device-01',
  localDeviceId:'my-device-01',onClearAck:id=>events.push(id)});
 const frame={kind:'clear_ack',requestId:'secure_clear_req_12345',
  sessionId,sender:approvedRemoteDevice,seq:1};
 assert.equal(c.receive(frame,{noiseRemoteDeviceId:'bad-device'}),false);
 assert.equal(c.receive(frame,{noiseRemoteDeviceId:approvedRemoteDevice}),true);
 assert.deepEqual(events,['secure_clear_req_12345']);
});
