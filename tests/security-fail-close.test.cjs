'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {SecurityFailClose}=require('../core/security-fail-close.cjs');
test('hide / stop media BEFORE encrypted peer failure notification',async()=>{
 const actions=[];
 const guard=new SecurityFailClose({
  hide:()=>actions.push('hide'),stopMedia:()=>actions.push('media'),
  clearChat:()=>actions.push('chat'),sendAuthenticated:async frame=>{actions.push('encrypted-notice');assert.equal(frame.kind,'security_fail');},
  dispose:()=>actions.push('keys'),deadlineMs:50
 });
 const outcome=await guard.trigger();
 assert.deepEqual(actions,['hide','media','chat','encrypted-notice','keys']);
 assert.equal(outcome.deliveryAttempted,true);assert.equal(outcome.peerConfirmed,false);
 await guard.trigger();assert.equal(actions.length,5);
});
test('no connection still disposes keys and closes',async()=>{
 const actions=[];
 const guard=new SecurityFailClose({hide:()=>actions.push('hide'),
  stopMedia:()=>actions.push('media'),clearChat:()=>actions.push('chat'),
  sendAuthenticated:async()=>{throw Error('offline');},dispose:()=>actions.push('keys')});
 const r=await guard.trigger();
 assert.equal(r.deliveryAttempted,false);
 assert.deepEqual(actions,['hide','media','chat','keys']);
});
test('hung networking cannot prevent key disposal',async()=>{
 const actions=[];
 const guard=new SecurityFailClose({hide:()=>actions.push('hide'),
  stopMedia:()=>actions.push('media'),clearChat:()=>actions.push('chat'),
  sendAuthenticated:()=>new Promise(()=>{}),dispose:()=>actions.push('keys'),deadlineMs:5});
 await guard.trigger();assert.equal(actions.at(-1),'keys');
});
