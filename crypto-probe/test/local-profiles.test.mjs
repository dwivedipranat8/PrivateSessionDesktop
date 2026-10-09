import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createLocalProfile,unlockLocalProfile,clearUnlockedProfile} from '../src/local-profiles.mjs';
const PASS_1='an example very long private passphrase one',PASS_2='another totally separate long private passphrase';
test('two independently created password profiles automatically identify account role',{timeout:90000},async()=>{
 const a=await mkdtemp(path.join(os.tmpdir(),'ps-profiles-a-'));
 const b=await mkdtemp(path.join(os.tmpdir(),'ps-profiles-b-'));
 const ha=path.join(a,'PrivateSession.identity.enc.json');
 const hb=path.join(b,'PrivateSession.identity.enc.json');
 try{
  const first=await createLocalProfile({target:ha,role:'host',passphrase:PASS_1});
  const second=await createLocalProfile({target:hb,role:'protected',passphrase:PASS_2});
  assert.notEqual(first.fingerprint,second.fingerprint);
  const one=await unlockLocalProfile({targets:[ha,hb],passphrase:PASS_1});
  assert.equal(one.role,'host');clearUnlockedProfile(one);
  const two=await unlockLocalProfile({targets:[ha,hb],passphrase:PASS_2});
  assert.equal(two.role,'protected');clearUnlockedProfile(two);
  await assert.rejects(unlockLocalProfile({targets:[ha,hb],passphrase:'bad but long password 123'}));
  assert.equal((await readFile(hb,'utf8')).includes(PASS_2),false);
 }finally{await rm(a,{recursive:true,force:true});await rm(b,{recursive:true,force:true});}
});
test('no accidental overwrites of existing protected identities',{timeout:45000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'ps-profile-test-'));
 const target=path.join(dir,'PrivateSession.identity.enc.json');
 try{
  await createLocalProfile({target,role:'host',passphrase:PASS_1});
  const previous=await readFile(target,'utf8');
  await assert.rejects(createLocalProfile({target,role:'protected',passphrase:PASS_2}));
  assert.equal(await readFile(target,'utf8'),previous);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('tampered account role or ciphertext refuses unlock',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'ps-profile-tamper-'));
 const target=path.join(dir,'PrivateSession.identity.enc.json');
 try{
  await createLocalProfile({target,role:'protected',passphrase:PASS_2});
  const doc=JSON.parse(await readFile(target,'utf8'));
  doc.accountRole='host';
  await writeFile(target,JSON.stringify(doc));
  await assert.rejects(unlockLocalProfile({targets:[target],passphrase:PASS_2}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
