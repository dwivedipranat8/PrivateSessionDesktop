import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLibp2p} from 'libp2p';
import {webSockets} from '@libp2p/websockets';
import {noise} from '@libp2p/noise';
import {yamux} from '@libp2p/yamux';
import {generateKeyPair} from '@libp2p/crypto/keys';
import {createPrivateRelay} from '../src/server.mjs';
import {makePinnedLeaseRequest} from '../src/client-lease-protocol.mjs';
test('true pinned encrypted relay server grants one active device per account',{timeout:30000},async()=>{
 const maker=()=>createLibp2p({addresses:{listen:[]},transports:[webSockets()],
  connectionEncrypters:[noise()],streamMuxers:[yamux()]});
 const host=await maker(),otherHost=await maker();
 const enrolled=new Map([[host.peerId.toString(),'partner'],[otherHost.peerId.toString(),'partner']]);
 let server;
 try{
  server=await createPrivateRelay({privateKey:await generateKeyPair('Ed25519'),
   enrolled,issuer:async()=>({iceServers:[]}),host:'127.0.0.1',port:0});
  const serverAddress=server.getMultiaddrs()[0].toString();
  const config={serverAddress,expectedServerPeerId:server.peerId.toString()};
  const first=makePinnedLeaseRequest({node:host,...config});
  const second=makePinnedLeaseRequest({node:otherHost,...config});
  const a=await first({operation:'begin'});
  assert.equal(a.ok,true);assert.equal(a.role,'host');
  const b=await second({operation:'begin'});
  assert.equal(b.ok,true);
  assert.notEqual(b.sessionId,a.sessionId);
  // Depending on takeover timing, the server may refuse or disconnect the
  // obsolete session's existing Noise connection. Both must be treated as DENY.
  let denied=false;
  try{denied=(await first({operation:'renew',sessionId:a.sessionId,generation:a.generation})).ok===false;}
  catch{denied=true;}
  assert.equal(denied,true);
  const renewed=await second({operation:'renew',sessionId:b.sessionId,generation:b.generation});
  assert.equal(renewed.ok,true);
 }finally{await Promise.allSettled([host.stop(),otherHost.stop(),server?.stop()]);}
});
test('pinning and protocol forbid password-based remote login',()=>{
 assert.throws(()=>makePinnedLeaseRequest({node:{},serverAddress:'x',expectedServerPeerId:'bad'}));
 const request=makePinnedLeaseRequest({node:{},serverAddress:'x',
  expectedServerPeerId:'12D3KooWAAAAAAAAAAAAAAAAAAAAAAAAA'});
 return assert.rejects(request({operation:'login',password:'stolen-password'}));
});
