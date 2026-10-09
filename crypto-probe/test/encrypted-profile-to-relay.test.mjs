import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createLibp2p} from 'libp2p';
import {webSockets} from '@libp2p/websockets';
import {circuitRelayServer} from '@libp2p/circuit-relay-v2';
import {identify} from '@libp2p/identify';
import {noise} from '@libp2p/noise';
import {yamux} from '@libp2p/yamux';
import {privateKeyFromProtobuf} from '@libp2p/crypto/keys';
import {createLocalProfile,unlockLocalProfile,clearUnlockedProfile} from '../src/local-profiles.mjs';
import {createPinnedClient} from '../src/pinned-client.mjs';
const require=createRequire(import.meta.url);
const {ReadReceipts}=require('../../core/read-receipts.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const SID='encrypted_profiled_session_12345',MSG='dummy_profiled_message_98765432';
test('encrypted profile passwords recover pinned identities that exchange authenticated Seen and bilateral Clear via Noise relay',{timeout:90000},async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'private-session-integrated-'));
 const hostPath=path.join(temp,'host','PrivateSession.identity.enc.json');
 const portablePath=path.join(temp,'portable','PrivateSession.identity.enc.json');
 const {mkdir}=await import('node:fs/promises');
 await mkdir(path.dirname(hostPath));await mkdir(path.dirname(portablePath));
 let hostProfile,portableProfile,relay,host,portable;
 try{
  await createLocalProfile({target:hostPath,role:'host',passphrase:'strong test-only host password 123456'});
  await createLocalProfile({target:portablePath,role:'protected',passphrase:'strong test-only protected password 987654'});
  hostProfile=await unlockLocalProfile({targets:[hostPath,portablePath],passphrase:'strong test-only host password 123456'});
  portableProfile=await unlockLocalProfile({targets:[hostPath,portablePath],passphrase:'strong test-only protected password 987654'});
  const hostKey=privateKeyFromProtobuf(hostProfile.identity.privateKeyBytes);
  const protectedKey=privateKeyFromProtobuf(portableProfile.identity.privateKeyBytes);
  let now=1000,seen=false,cleared=false;
  const receipts=new ReadReceipts({sessionId:SID,clock:()=>now});
  relay=await createLibp2p({addresses:{listen:['/ip4/127.0.0.1/tcp/0/ws']},
   transports:[webSockets()],connectionEncrypters:[noise()],streamMuxers:[yamux()],
   services:{identify:identify(),relay:circuitRelayServer()}});
  host=await createPinnedClient({privateKey:hostKey,sessionId:SID,requireServerLease:false,onFrame:(frame,auth)=>{
   if(frame.kind==='seen'&&auth.noiseRemotePeerId===portable.peerId&&frame.messageId===MSG){
    seen=receipts.seen({sessionId:SID,id:MSG,deviceId:portable.peerId},{authenticated:true});
    return seen;
   }
   if(frame.kind==='clear_end'&&auth.noiseRemotePeerId===portable.peerId){
    cleared=true;receipts.clear();return true;
   }
   return false;
  }});
  portable=await createPinnedClient({privateKey:protectedKey,sessionId:SID,requireServerLease:false,onFrame:async(frame,auth)=>{
   if(auth.noiseRemotePeerId!==host.peerId||frame.kind!=='text'||frame.messageId!==MSG)return false;
   return portable.send({kind:'seen',sessionId:SID,sender:portable.peerId,seq:1,messageId:MSG});
  }});
  host.approvePeer(portable.peerId);
  portable.approvePeer(host.peerId);
  const address=relay.getMultiaddrs().find(x=>x.toString().includes('127.0.0.1'));
  await host.joinRelay(address,relay.peerId.toString());
  await portable.joinRelay(address,relay.peerId.toString());
  let endpoint;
  for(let i=0;i<100;i++){
   endpoint=portable.relayedAddresses.find(x=>x.toString().includes('/p2p-circuit/p2p/'));
   if(endpoint)break;
   await delay(100);
  }
  assert.ok(endpoint,'Encrypted portable peer not reachable through relay');
  await host.connect(endpoint);
  receipts.send(MSG,portable.peerId);
  assert.equal(await host.send({kind:'text',sessionId:SID,sender:host.peerId,seq:1,messageId:MSG,text:'DUMMY TEST ONLY'}),true);
  for(let i=0;i<80&&!seen;i++)await delay(100);
  assert.equal(seen,true,'Host should get authenticated Seen receipt from decrypted protected profile');
  now+=119999;
  assert.deepEqual(receipts.expire(),[]);
  now+=1;
  assert.deepEqual(receipts.expire(),[MSG]);
  assert.equal(await portable.send({kind:'clear_end',sessionId:SID,sender:portable.peerId,seq:2,
   requestId:'dummy_clear_req_01234567'}),true);
  for(let i=0;i<80&&!cleared;i++)await delay(100);
  assert.equal(cleared,true);
  assert.equal(host.peerId===portable.peerId,false);
 }finally{
  await Promise.allSettled([host?.end(),portable?.end(),relay?.stop()]);
  clearUnlockedProfile(hostProfile);
  clearUnlockedProfile(portableProfile);
  await rm(temp,{recursive:true,force:true});
 }
});
