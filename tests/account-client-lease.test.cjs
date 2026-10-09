'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {AccountClientLease}=require('../core/account-client-lease.cjs');
const sessionId='fresh_account_lease_secret_1234';
function rig(sendRenew=async()=>({ok:true,role:'host',generation:1,expiresInMs:3000})){
 let now=1000,events=[];
 const lease=new AccountClientLease({role:'host',clock:()=>now,
  sendRenew,onStop:reason=>events.push(reason)});
 return {lease,events,wait:d=>now+=d};
}
test('correct authorized renewal keeps only active host authorized',async()=>{
 const r=rig();r.lease.begin({role:'host',sessionId,generation:1,expiresInMs:3000});
 r.wait(1000);assert.equal(await r.lease.tick(),true);assert.equal(r.lease.healthy,true);
});
test('server rejects old device: immediately terminate once rejection arrives',async()=>{
 const r=rig(async()=>({ok:false,error:'revoked'}));
 r.lease.begin({role:'host',sessionId,generation:1,expiresInMs:3000});
 assert.equal(await r.lease.tick(),false);assert.equal(r.lease.healthy,false);
 assert.deepEqual(r.events,['Account device was revoked']);
});
test('definitive network/USB event stops before a renewal callback',()=>{
 const r=rig();r.lease.begin({role:'host',sessionId,generation:1,expiresInMs:3000});
 assert.equal(r.lease.fail('Connection lost'),true);
 assert.equal(r.lease.fail('Double notification'),false);
 assert.deepEqual(r.events,['Connection lost']);
});
test('late success never resurrects an expired lease',async()=>{
 let accept;const r=rig(()=>new Promise(resolve=>{accept=resolve;}));
 r.lease.begin({role:'host',sessionId,generation:1,expiresInMs:3000});
 const pending=r.lease.tick();
 r.wait(3000);assert.equal(r.lease.healthy,false);
 assert.equal(r.lease.fail('Deadline expired'),true);
 accept({ok:true,role:'host',generation:1,expiresInMs:3000});
 assert.equal(await pending,false);
 assert.equal(r.lease.healthy,false);assert.equal(r.events.length,1);
});
test('even a forged successful role mismatch cannot extend account access',async()=>{
 const r=rig(async()=>({ok:true,role:'protected',generation:1,expiresInMs:3000}));
 r.lease.begin({role:'host',sessionId,generation:1,expiresInMs:3000});
 assert.equal(await r.lease.tick(),false);
});
test('can't start with wrong-account or expired lease',()=>{
 const r=rig();
 assert.throws(()=>r.lease.begin({role:'protected',sessionId,generation:1,expiresInMs:3000}));
 assert.throws(()=>r.lease.begin({role:'host',sessionId,generation:1,expiresInMs:999999}));
});
