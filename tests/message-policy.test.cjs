'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {MessagePolicy}=require('../core/message-policy.js');
test('unseen dummy text expires after 30 seconds',()=>{
 const m=new MessagePolicy(1000);assert.equal(m.expiresAt(),31000);
});
test('message expires 2 seconds after seen',()=>{
 const m=new MessagePolicy(1000);assert.equal(m.markSeen(5000),true);assert.equal(m.expiresAt(),7000);
});
test('duplicate seen cannot extend expiration',()=>{
 const m=new MessagePolicy(1000);m.markSeen(4000);
 assert.equal(m.markSeen(7000),false);assert.equal(m.expiresAt(),6000);
});
test('late seen does not extend initial expiry',()=>{
 const m=new MessagePolicy(0);m.markSeen(29500);
 assert.equal(m.expiresAt(),30000);assert.equal(m.markSeen(31000),false);
});
