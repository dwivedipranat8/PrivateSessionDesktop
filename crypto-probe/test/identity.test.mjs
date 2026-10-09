import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newIdentity,lockIdentity,unlockIdentity} from '../src/identity.mjs';
test('new device Ed25519 identity encrypts and unlocks consistently',{timeout:30000},async()=>{
 const first=await newIdentity();
 const stored=await lockIdentity(first.privateKeyBytes,'example passphrase that is long');
 assert.ok(!stored.includes(Buffer.from(first.privateKeyBytes).toString('base64url')));
 const restored=await unlockIdentity(stored,'example passphrase that is long');
 assert.equal(restored.fingerprint,first.fingerprint);
 assert.deepEqual(restored.publicKeyBytes,first.publicKeyBytes);
 assert.deepEqual(restored.privateKeyBytes,first.privateKeyBytes);
 first.privateKeyBytes.fill(0);restored.privateKeyBytes.fill(0);
});
test('wrong password or tampered ciphertext must fail closed',{timeout:30000},async()=>{
 const first=await newIdentity();
 const stored=await lockIdentity(first.privateKeyBytes,'a completely different test password');
 await assert.rejects(unlockIdentity(stored,'an incorrect dummy passphrase'));
 const hacked=JSON.parse(stored);
 hacked.data=(hacked.data[0]==='A'?'B':'A')+hacked.data.slice(1);
 await assert.rejects(unlockIdentity(JSON.stringify(hacked),'a completely different test password'));
 first.privateKeyBytes.fill(0);
});
test('each device has a distinct fingerprint',{timeout:30000},async()=>{
 const [a,b]=await Promise.all([newIdentity(),newIdentity()]);
 assert.notEqual(a.fingerprint,b.fingerprint);
 a.privateKeyBytes.fill(0);b.privateKeyBytes.fill(0);
});
