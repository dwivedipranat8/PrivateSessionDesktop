'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {SecureControl}=require('../core/secure-control.cjs');
const sessionId='session_0123456789',approvedRemoteDevice='approved_peer_01';
function rig(hostDeviceId=approvedRemoteDevice){
 const event=[];
 const c=new SecureControl({sessionId,approvedRemoteDevice,hostDeviceId,localDeviceId:'my-device-01',
  onEnd:()=>event.push('end'),onDelete:()=>event.push('delete'),
  onSeen:id=>event.push('seen:'+id),onText:(_id,msg)=>event.push('text:'+msg)});
 return {c,event};
}
test('authenticated host remote delete; no unsigned or wrong peer',()=>{
 const r=rig(),msg={kind:'delete',sessionId,sender:approvedRemoteDevice,seq:1};
 assert.equal(r.c.receive(msg,{noiseRemoteDeviceId:'attacker-device'}),false);
 assert.equal(r.c.receive(msg,{noiseRemoteDeviceId:approvedRemoteDevice}),true);
 assert.deepEqual(r.event,['delete']);
 assert.equal(r.c.receive(msg,{noiseRemoteDeviceId:approvedRemoteDevice}),false);
});
test('guest cannot remotely issue host delete',()=>{
 const r=rig('my-device-01'),msg={kind:'delete',sessionId,sender:approvedRemoteDevice,seq:1};
 assert.equal(r.c.receive(msg,{noiseRemoteDeviceId:approvedRemoteDevice}),false);
 assert.deepEqual(r.event,[]);
});
test('seen event and texts are session and sequence bound',()=>{
 const r=rig(),receipt={kind:'seen',sessionId,sender:approvedRemoteDevice,seq:1,messageId:'message_0123456'};
 assert.equal(r.c.receive({...receipt,sessionId:'session_unknown-00000'},{noiseRemoteDeviceId:approvedRemoteDevice}),false);
 assert.equal(r.c.receive(receipt,{noiseRemoteDeviceId:approvedRemoteDevice}),true);
 assert.deepEqual(r.event,['seen:message_0123456']);
 assert.equal(r.c.receive({...receipt,seq:3},{noiseRemoteDeviceId:approvedRemoteDevice}),false);
});
test('remote End prevents messages after end',()=>{
 const r=rig(),msg={kind:'end',sessionId,sender:approvedRemoteDevice,seq:1};
 assert.equal(r.c.receive(msg,{noiseRemoteDeviceId:approvedRemoteDevice}),true);
 assert.equal(r.c.receive({...msg,kind:'text',seq:2,messageId:'message_0123456',text:'hello'},
    {noiseRemoteDeviceId:approvedRemoteDevice}),false);
 assert.deepEqual(r.event,['end']);
});
