'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ReadReceipts}=require('../core/read-receipts.cjs');
const sessionId='known-session-id';
function rig(){let time=10;return {receipt:new ReadReceipts({sessionId,clock:()=>time}),wait:d=>time+=d};}
test('120 seconds after FIRST authenticated seen',()=>{
 const r=rig();r.receipt.send('message-123456','approved-device');
 r.wait(100);assert.equal(r.receipt.seen({sessionId,id:'message-123456',deviceId:'approved-device'},{authenticated:true}),true);
 r.wait(119999);assert.deepEqual(r.receipt.expire(),[]);r.wait(1);
 assert.deepEqual(r.receipt.expire(),['message-123456']);
});
test('unseen messages expire after 120 seconds',()=>{
 const r=rig();r.receipt.send('message-123456','approved-device');
 r.wait(119999);assert.deepEqual(r.receipt.expire(),[]);
 r.wait(1);assert.deepEqual(r.receipt.expire(),['message-123456']);
});
test('Seen at 119s grants the full 120 seconds',()=>{
 const r=rig();r.receipt.send('message-123456','approved-device');
 r.wait(119000);assert.equal(r.receipt.seen({sessionId,id:'message-123456',deviceId:'approved-device'},{authenticated:true}),true);
 r.wait(119999);assert.deepEqual(r.receipt.expire(),[]);
 r.wait(1);assert.deepEqual(r.receipt.expire(),['message-123456']);
});
test('Seen after unseen deadline refused',()=>{
 const r=rig();r.receipt.send('message-123456','approved-device');
 r.wait(120000);
 assert.equal(r.receipt.seen({sessionId,id:'message-123456',deviceId:'approved-device'},{authenticated:true}),false);
});
test('wrong device, unauthenticated and duplicate Seen cannot extend deadline',()=>{
 const r=rig();r.receipt.send('message-123456','approved-device');
 assert.equal(r.receipt.seen({sessionId,id:'message-123456',deviceId:'approved-device'}),false);
 assert.equal(r.receipt.seen({sessionId,id:'message-123456',deviceId:'other-device'},{authenticated:true}),false);
 assert.equal(r.receipt.seen({sessionId,id:'message-123456',deviceId:'approved-device'},{authenticated:true}),true);
 const deadline=r.receipt.expiresAt('message-123456');
 r.wait(1000);
 assert.equal(r.receipt.seen({sessionId,id:'message-123456',deviceId:'approved-device'},{authenticated:true}),false);
 assert.equal(r.receipt.expiresAt('message-123456'),deadline);
});
test('Clear erases pending message state',()=>{
 const r=rig();r.receipt.send('message-123456','approved-device');r.receipt.clear();
 assert.deepEqual(r.receipt.expire(),[]);assert.equal(r.receipt.expiresAt('message-123456'),null);
});

test('untrusted send flood is bounded without discarding existing protected messages',()=>{
 let now=0;
 const r=new ReadReceipts({sessionId,clock:()=>now,maxMessages:2});
 assert.equal(r.send('message-000001','approved-device'),true);
 assert.equal(r.send('message-000002','approved-device'),true);
 assert.equal(r.send('message-000003','approved-device'),false);
 assert.equal(r.expiresAt('message-000001'),120000);
 now=120000;
 assert.deepEqual(r.expire(),['message-000001','message-000002']);
 assert.equal(r.send('message-000003','approved-device'),true);
});
test('read-receipt maximum cannot be disabled or made unbounded',()=>{
 for(const maxMessages of [0,-1,Infinity,100000,NaN])
  assert.throws(()=>new ReadReceipts({sessionId,maxMessages}));
});
