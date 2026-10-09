'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ReadReceipts}=require('../core/read-receipts.cjs');
const sessionId='known-session-id';
function rig(){let time=10;return {receipt:new ReadReceipts({sessionId,clock:()=>time}),wait:d=>time+=d};}
test('two seconds from authenticated receiver receipt',()=>{
 const r=rig();r.receipt.send('message-123456','approved-device');
 r.wait(100);assert.equal(r.receipt.seen({sessionId,id:'message-123456',deviceId:'approved-device'},{authenticated:true}),true);
 r.wait(1999);assert.deepEqual(r.receipt.expire(),[]);r.wait(1);
 assert.deepEqual(r.receipt.expire(),['message-123456']);
});
test('unseen messages expire after 30 seconds',()=>{
 const r=rig();r.receipt.send('message-123456','approved-device');
 r.wait(30000);assert.deepEqual(r.receipt.expire(),['message-123456']);
});
test('not trusting wrong device, unauthenticated or duplicate receipt',()=>{
 const r=rig();r.receipt.send('message-123456','approved-device');
 assert.equal(r.receipt.seen({sessionId,id:'message-123456',deviceId:'approved-device'}),false);
 assert.equal(r.receipt.seen({sessionId,id:'message-123456',deviceId:'wrong-device'},{authenticated:true}),false);
 assert.equal(r.receipt.seen({sessionId,id:'message-123456',deviceId:'approved-device'},{authenticated:true}),true);
 assert.equal(r.receipt.seen({sessionId,id:'message-123456',deviceId:'approved-device'},{authenticated:true}),false);
});
