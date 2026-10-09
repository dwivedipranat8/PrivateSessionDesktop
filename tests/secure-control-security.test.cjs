'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {SecureControl}=require('../core/secure-control.cjs');
test('only authenticated peer can signal security failure',()=>{
 const notices=[],sid='session_id_abcdefghij',peer='peer_device_123456789';
 const handler=new SecureControl({sessionId:sid,approvedRemoteDevice:peer,
   hostDeviceId:peer,localDeviceId:'local_device_abcde',
   onSecurityFailure:msg=>notices.push(msg)});
 const frame={kind:'security_fail',sessionId:sid,sender:peer,seq:1};
 assert.equal(handler.receive(frame,{noiseRemoteDeviceId:'unapproved-device'}),false);
 assert.deepEqual(notices,[]);
 assert.equal(handler.receive(frame,{noiseRemoteDeviceId:peer}),true);
 assert.deepEqual(notices,['Peer device security requirements not satisfied.']);
 assert.equal(handler.receive({...frame,seq:2},{noiseRemoteDeviceId:peer}),false);
});
