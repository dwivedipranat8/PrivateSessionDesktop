'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {PeerLease}=require('../core/peer-lease.cjs');
test('no first authenticated heartbeat -> terminate rather than indefinite wait',()=>{
 let now=100;
 let protections=0,expiries=0;
 const lease=new PeerLease({sessionId:'nopeer_session_01234',clock:()=>now,
  onProtect:()=>protections++,onExpire:()=>expiries++});
 now+=4999;assert.equal(lease.tick(),'awaiting-proof');
 now+=1;assert.equal(lease.tick(),'expired');
 assert.equal(protections,1);assert.equal(expiries,1);
});
