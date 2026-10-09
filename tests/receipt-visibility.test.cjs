'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {SeenGate,canAcknowledgeSeen}=require('../core/receipt-visibility.cjs');
const ready={sessionActive:true,windowFocused:true,documentVisible:true,inViewport:true,covered:false,mediaHealthy:true};
test('unread hidden/background/wrong-view message does not acknowledge',()=>{
 for(const key of ['sessionActive','windowFocused','documentVisible','inViewport','mediaHealthy'])
  assert.equal(canAcknowledgeSeen({...ready,[key]:false}),false);
 assert.equal(canAcknowledgeSeen({...ready,covered:true}),false);
});
test('first actually visible message eligible once per session',()=>{
 const s=new SeenGate(),id='message_123456789';
 assert.equal(s.shouldSend(id,{...ready,documentVisible:false}),false);
 assert.equal(s.shouldSend(id,ready),true);
 assert.equal(s.shouldSend(id,ready),false);
 s.clear();assert.equal(s.shouldSend(id,ready),true);
});
