'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {PeerLease}=require('../core/peer-lease.cjs');
const SID='long-session-id-98765';
function rig(){
 let time=1000,n=0,protectedN=0,expiredN=0;
 const lease=new PeerLease({sessionId:SID,clock:()=>time,random:()=>('random-token-'+(++n)).padEnd(25,'x'),
 onProtect:()=>protectedN++,onExpire:()=>expiredN++});
 return {lease,wait:d=>time+=d,counts:()=>[protectedN,expiredN]};
}
test('requires authenticated peer reply before active',()=>{
 const r=rig(),c=r.lease.challenge(),response={kind:'response',sessionId:SID,token:c.token};
 assert.equal(r.lease.accept(response),false);
 assert.equal(r.lease.accept(response,{authenticated:true}),true);
 assert.equal(r.lease.active,true);
});
test('3 seconds protect; 5 seconds expire; no resurrection',()=>{
 const r=rig(),c=r.lease.challenge(),response={kind:'response',sessionId:SID,token:c.token};
 r.lease.accept(response,{authenticated:true});r.wait(2999);assert.equal(r.lease.tick(),'active');
 r.wait(1);assert.equal(r.lease.tick(),'protected');assert.deepEqual(r.counts(),[1,0]);
 r.wait(2000);assert.equal(r.lease.tick(),'expired');assert.deepEqual(r.counts(),[1,1]);
 assert.equal(r.lease.accept(response,{authenticated:true}),false);
});
test('2.9 seconds delayed reply rejected',()=>{
 const r=rig(),c=r.lease.challenge();r.wait(2900);
 assert.equal(r.lease.accept({kind:'response',sessionId:SID,token:c.token},{authenticated:true}),false);
});
test('late receipt cannot extend time beyond issue time',()=>{
 const r=rig(),c=r.lease.challenge();r.wait(1600);
 r.lease.accept({kind:'response',sessionId:SID,token:c.token},{authenticated:true});
 r.wait(1400);assert.equal(r.lease.tick(),'protected');
});
test('manual failure expires immediately',()=>{
 const r=rig();r.lease.invalidate();r.lease.invalidate();
 assert.deepEqual(r.counts(),[1,1]);assert.equal(r.lease.challenge(),null);
});
