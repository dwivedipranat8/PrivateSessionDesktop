import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AccountSessions} from '../src/account-sessions.mjs';
const a='12D3KooWAAAAAAAAAAAAAAAAAAAAAAAAA',b='12D3KooWBBBBBBBBBBBBBBBBBBBBBBBBB',guest='12D3KooWCCCCCCCCCCCCCCCCCCCCCCCCC';
function env(){
 let now=1000,issued=0;const notices=[];
 const enrolled=new Map([[a,'partner'],[b,'partner'],[guest,'portable']]);
 const accounts=new AccountSessions({enrolled,clock:()=>now,makeId:()=>('token_'+(++issued)).padEnd(35,'x'),
   onRevoked:notice=>notices.push(notice)});
 return {accounts,enrolled,notices,wait:n=>{now+=n;}};
}
test('distinct host/protected local passwords are NOT server-held or used for authentication',()=>{
 const {accounts}=env();
 assert.equal(accounts.begin({authenticatedPeerId:a}).role,'host');
 assert.equal(accounts.begin({authenticatedPeerId:guest}).role,'protected');
 assert.throws(()=>accounts.begin({authenticatedPeerId:'password-only'}));
 assert.equal(Object.keys(accounts).some(x=>x.includes('password')),false);
});
test('new authorized host device immediately revokes old server-side lease',()=>{
 const r=env(),first=r.accounts.begin({authenticatedPeerId:a});
 const later=r.accounts.begin({authenticatedPeerId:b});
 assert.equal(r.accounts.isActive({...first,authenticatedPeerId:a}),false);
 assert.equal(r.accounts.renew({...first,authenticatedPeerId:a}).ok,false);
 assert.equal(r.accounts.isActive({...later,authenticatedPeerId:b}),true);
 assert.equal(r.notices.length,1);
 assert.equal(r.notices[0].peerId,a);
});
test('wrong key cannot renew active lease, even with stolen session token',()=>{
 const r=env(),lease=r.accounts.begin({authenticatedPeerId:a});
 assert.equal(r.accounts.renew({...lease,authenticatedPeerId:b}).ok,false);
 assert.equal(r.accounts.renew({...lease,authenticatedPeerId:guest}).ok,false);
 assert.equal(r.accounts.isActive({...lease,authenticatedPeerId:a}),true);
});
test('offline leases expire; no automatic restoration with old tokens',()=>{
 const r=env(),lease=r.accounts.begin({authenticatedPeerId:a});
 r.wait(3000);
 assert.equal(r.accounts.isActive({...lease,authenticatedPeerId:a}),false);
 assert.equal(r.accounts.renew({...lease,authenticatedPeerId:a}).ok,false);
 const fresh=r.accounts.begin({authenticatedPeerId:a});
 assert.notEqual(fresh.generation,lease.generation);
 assert.equal(r.accounts.isActive({...lease,authenticatedPeerId:a}),false);
});
test('revoke enrolled device invalidates its account; device password does not reenroll',()=>{
 const r=env(),lease=r.accounts.begin({authenticatedPeerId:a});
 r.enrolled.delete(a);r.accounts.sweep();
 assert.equal(r.accounts.isActive({...lease,authenticatedPeerId:a}),false);
 assert.throws(()=>r.accounts.begin({authenticatedPeerId:a}));
});
test('host and protected have independent leases, each at most one',()=>{
 const r=env(),host=r.accounts.begin({authenticatedPeerId:a});
 const other=r.accounts.begin({authenticatedPeerId:guest});
 assert.equal(r.accounts.isActive({...host,authenticatedPeerId:a}),true);
 assert.equal(r.accounts.isActive({...other,authenticatedPeerId:guest}),true);
});

test('old/revoked devices lose TURN and relay eligibility before generation reuse',()=>{
 const r=env(),first=r.accounts.begin({authenticatedPeerId:a});
 assert.equal(r.accounts.isCurrentDevice(a),true);
 r.accounts.begin({authenticatedPeerId:b});
 assert.equal(r.accounts.isCurrentDevice(a),false);
 assert.equal(r.accounts.isCurrentDevice(b),true);
 r.enrolled.delete(b);assert.equal(r.accounts.isCurrentDevice(b),false);
});
