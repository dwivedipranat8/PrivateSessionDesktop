'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {MessagePolicy}=require('../core/message-policy.js');
test('unseen expires at 120 seconds',()=>{assert.equal(new MessagePolicy(1000).expiresAt(),121000);});
test('Seen begins full 120-second deadline',()=>{
 const m=new MessagePolicy(1000);assert.equal(m.markSeen(5000),true);assert.equal(m.expiresAt(),125000);
});
test('duplicate Seen cannot extend deadline',()=>{
 const m=new MessagePolicy(1000);m.markSeen(4000);assert.equal(m.markSeen(7000),false);
 assert.equal(m.expiresAt(),124000);
});
test('late Seen grants full 120 seconds, not capped by unseen timeout',()=>{
 const m=new MessagePolicy(0);assert.equal(m.markSeen(119500),true);
 assert.equal(m.expiresAt(),239500);assert.equal(m.markSeen(121000),false);
});
test('Seen at unseen deadline is refused',()=>{
 const m=new MessagePolicy(0);assert.equal(m.markSeen(120000),false);assert.equal(m.expiresAt(),120000);
});
