import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,privateKeyToProtobuf} from '@libp2p/crypto/keys';
import {peerIdFromPrivateKey} from '@libp2p/peer-id';
import {createDesktopChat} from '../src/desktop-chat.mjs';
import {createPrivateRelay} from '../../relay-service/src/server.mjs';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const SESSION='enrolled_secure_heartbeat_session_001';
test('restricted relay grants real one-device leases, E2EE text and automatic verified Seen',{timeout:85000},async()=>{
 const hkey=await generateKeyPair('Ed25519'),pkey=await generateKeyPair('Ed25519');
 const hostId=peerIdFromPrivateKey(hkey).toString(),protectedId=peerIdFromPrivateKey(pkey).toString();
 const enrolled=new Map([[hostId,'partner'],[protectedId,'portable']]);
 const events={host:[],protected:[]};
 let relay,host,protectedChat;
 try{
  relay=await createPrivateRelay({privateKey:await generateKeyPair('Ed25519'),
   enrolled,issuer:async()=>({iceServers:[{urls:'turns:dummy.invalid:5349',
    username:'dummy',credential:'dummy'}]}),port:0,host:'127.0.0.1'});
  const address=relay.getMultiaddrs()[0].toString(),relayId=relay.peerId.toString();
  host=await createDesktopChat({privateKeyBytes:privateKeyToProtobuf(hkey),role:'host',
   relayAddress:address,relayPeerId:relayId,approvedPeerId:protectedId,sessionId:SESSION,
   onEvent:e=>events.host.push(e)});
  protectedChat=await createDesktopChat({privateKeyBytes:privateKeyToProtobuf(pkey),role:'protected',
   relayAddress:address,relayPeerId:relayId,approvedPeerId:hostId,sessionId:SESSION,
   onEvent:e=>{
    events.protected.push(e);
    if(e.type==='incoming')void protectedChat.reportDisplayed(e.id);
   }});
  let destination=null;
  for(let i=0;i<80;i++){
   destination=protectedChat.ownCircuitAddresses.find(a=>a.includes('/p2p-circuit/p2p/'));
   if(destination)break;
   await delay(100);
  }
  assert.ok(destination,'Authenticated protected relay reservation absent');
  await host.connect(destination);
  for(let i=0;i<100&&(!host.connected||!protectedChat.connected);i++)await delay(100);
  assert.equal(host.connected,true,'Host encrypted heartbeat proof missing');
  assert.equal(protectedChat.connected,true,'Protected encrypted heartbeat proof missing');
  const sent=await host.sendText('DUMMY TEST ONLY');
  assert.equal(sent.id.length>=12,true);
  for(let i=0;i<100&&!events.host.some(e=>e.type==='seen'&&e.id===sent.id);i++)
   await delay(100);
  assert.ok(events.protected.some(e=>e.type==='incoming'&&e.text==='DUMMY TEST ONLY'));
  assert.ok(events.host.some(e=>e.type==='seen'&&e.id===sent.id));
  assert.equal((await host.getTurnConfig()).iceServers.length,1);
  const cleared=await protectedChat.clearAndEnd();
  assert.equal(cleared.localCleared,true);
  for(let i=0;i<40&&!events.host.some(e=>e.type==='cleared');i++)await delay(100);
  assert.ok(events.host.some(e=>e.type==='cleared'));
 }finally{
  await Promise.allSettled([host?.close(),protectedChat?.close(),relay?.stop()]);
 }
});
