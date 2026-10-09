import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newIdentity,lockIdentity,unlockIdentity} from '../src/identity.mjs';
test('new device Ed25519 identity encrypts and unlocks consistently',{timeout:30000},async()=>{
 const first=await newIdentity();
 const stored=await lockIdentity(first.privateKeyBytes,'example passphrase that is long',{accountRole:'host'});
 assert.ok(!stored.includes(Buffer.from(first.privateKeyBytes).toString('base64url')));
 const restored=await unlockIdentity(stored,'example passphrase that is long',{expectedAccountRole:'host'});
 assert.equal(restored.fingerprint,first.fingerprint);
 assert.deepEqual(restored.publicKeyBytes,first.publicKeyBytes);
 assert.deepEqual(restored.privateKeyBytes,first.privateKeyBytes);
 first.privateKeyBytes.fill(0);restored.privateKeyBytes.fill(0);
});
test('wrong password or tampered ciphertext must fail closed',{timeout:30000},async()=>{
 const first=await newIdentity();
 const stored=await lockIdentity(first.privateKeyBytes,'a completely different test password',{accountRole:'protected'});
 await assert.rejects(unlockIdentity(stored,'an incorrect dummy passphrase',{expectedAccountRole:'protected'}));
 const hacked=JSON.parse(stored);
 hacked.data=(hacked.data[0]==='A'?'B':'A')+hacked.data.slice(1);
 await assert.rejects(unlockIdentity(JSON.stringify(hacked),'a completely different test password',{expectedAccountRole:'protected'}));
 first.privateKeyBytes.fill(0);
});
test('each device has a distinct fingerprint',{timeout:30000},async()=>{
 const [a,b]=await Promise.all([newIdentity(),newIdentity()]);
 assert.notEqual(a.fingerprint,b.fingerprint);
 a.privateKeyBytes.fill(0);b.privateKeyBytes.fill(0);
});

test('different accounts have separate role-bound encrypted profiles',{timeout:30000},async()=>{
 const [host,protectedDevice]=await Promise.all([newIdentity(),newIdentity()]);
 const hp='host-test-passphrase-not-real',pp='protected-test-passphrase-not-real';
 const lockedHost=await lockIdentity(host.privateKeyBytes,hp,{accountRole:'host'});
 const lockedProtected=await lockIdentity(protectedDevice.privateKeyBytes,pp,{accountRole:'protected'});
 const decoded=await unlockIdentity(lockedHost,hp,{expectedAccountRole:'host'});
 assert.equal(decoded.accountRole,'host');
 await assert.rejects(unlockIdentity(lockedHost,hp,{expectedAccountRole:'protected'}));
 await assert.rejects(unlockIdentity(lockedProtected,hp,{expectedAccountRole:'protected'}));
 const tampered=JSON.parse(lockedProtected);
 tampered.accountRole='host';
 await assert.rejects(unlockIdentity(JSON.stringify(tampered),pp,{expectedAccountRole:'host'}));
 decoded.privateKeyBytes.fill(0);host.privateKeyBytes.fill(0);protectedDevice.privateKeyBytes.fill(0);
});
