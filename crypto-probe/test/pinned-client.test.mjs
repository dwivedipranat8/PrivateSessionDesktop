import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLibp2p} from 'libp2p';
import {webSockets} from '@libp2p/websockets';
import {circuitRelayServer} from '@libp2p/circuit-relay-v2';
import {identify} from '@libp2p/identify';
import {noise} from '@libp2p/noise';
import {yamux} from '@libp2p/yamux';
import {generateKeyPair} from '@libp2p/crypto/keys';
import {createPinnedClient} from '../src/pinned-client.mjs';
const sessionId='verified_session_for_dummy';
const delay=t=>new Promise(r=>setTimeout(r,t));
test('two pinned, encrypted relay clients can exchange only session-bound dummy frames',{timeout:50000},async()=>{
 const relay=await createLibp2p({
  addresses:{listen:['/ip4/127.0.0.1/tcp/0/ws']},transports:[webSockets()],
  connectionEncrypters:[noise()],streamMuxers:[yamux()],
  services:{identify:identify(),relay:circuitRelayServer()}
 });
 const received=[],a=await createPinnedClient({privateKey:await generateKeyPair('Ed25519'),
   sessionId,onFrame:(frame,meta)=>{received.push({side:'a',frame,meta});return true;}});
 const b=await createPinnedClient({privateKey:await generateKeyPair('Ed25519'),
   sessionId,onFrame:(frame,meta)=>{received.push({side:'b',frame,meta});return true;}});
 const relayAddr=relay.getMultiaddrs().find(x=>x.toString().includes('127.0.0.1'));
 assert.ok(relayAddr);
 try{
  a.approvePeer(b.peerId);b.approvePeer(a.peerId);
  await a.joinRelay(relayAddr,relay.peerId.toString());
  await b.joinRelay(relayAddr,relay.peerId.toString());
  let bAddr=null;
  for(let i=0;i<100;i++){
   bAddr=b.relayedAddresses.find(x=>x.toString().includes('/p2p-circuit/p2p/'));
   if(bAddr)break;
   await delay(100);
  }
  assert.ok(bAddr,'Receiver relay reservation not ready');
  await a.connect(bAddr);
  const sent=await a.send({kind:'text',seq:1,sessionId,sender:a.peerId,
   messageId:'dummy_message_01234',text:'DUMMY CONTENT'});
  assert.equal(sent,true);
  for(let i=0;i<50&&received.length===0;i++)await delay(100);
  assert.equal(received.length,1);
  assert.equal(received[0].side,'b');
  assert.equal(received[0].frame.text,'DUMMY CONTENT');
  assert.equal(received[0].frame.version,1);
  assert.equal(received[0].meta.noiseRemotePeerId,a.peerId);
  assert.equal(await a.send({kind:'text',seq:2,sessionId:'wrong_session',sender:a.peerId,text:'INVALID'}),false);
 }finally{await Promise.allSettled([a.end(),b.end(),relay.stop()]);}
});
