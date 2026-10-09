import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLibp2p} from 'libp2p';
import {webSockets} from '@libp2p/websockets';
import {noise} from '@libp2p/noise';
import {yamux} from '@libp2p/yamux';
import {generateKeyPair} from '@libp2p/crypto/keys';
import {lpStream} from '@libp2p/utils';
import {createPrivateRelay} from '../src/server.mjs';

test('two independently approved host devices cannot hold concurrent leases',{timeout:30000},async()=>{
 const key=await generateKeyPair('Ed25519');
 const create=()=>createLibp2p({addresses:{listen:[]},
  transports:[webSockets()],connectionEncrypters:[noise()],streamMuxers:[yamux()]});
 const host1=await create(),host2=await create(),protectedPeer=await create();
 const enrollment=new Map([[host1.peerId.toString(),'partner'],[host2.peerId.toString(),'partner'],
  [protectedPeer.peerId.toString(),'portable']]);
 let server;
 async function command(node,operation,detail={}){
  const c=await node.dial(server.getMultiaddrs()[0],{signal:AbortSignal.timeout(6000)});
  assert.equal(c.remotePeer.toString(),server.peerId.toString());
  const stream=await node.dialProtocol(server.peerId,'/private-session/account-lease/1.0.0');
  const framed=lpStream(stream);
  await framed.write(new TextEncoder().encode(JSON.stringify({operation,...detail})));
  const answer=await framed.read({signal:AbortSignal.timeout(6000)});
  const output=JSON.parse(new TextDecoder().decode(answer.subarray()));
  await stream.close();return output;
 }
 try{
  server=await createPrivateRelay({privateKey:key,enrolled:enrollment,host:'127.0.0.1',port:0,
   issuer:async()=>({iceServers:[{urls:['turn:mock.invalid'],username:'x',credential:'x'}]})});
  const h1=await command(host1,'begin');
  assert.equal(h1.role,'host');
  const p=await command(protectedPeer,'begin');
  assert.equal(p.role,'protected');
  const h2=await command(host2,'begin');
  assert.notEqual(h2.sessionId,h1.sessionId);
  let previousRejected=false;
  try{
    const response=await command(host1,'renew',{sessionId:h1.sessionId,generation:h1.generation});
    previousRejected=response.ok===false;
  }catch{
    // A force-closed Noise connection on takeover is an intentional denial.
    previousRejected=true;
  }
  assert.equal(previousRejected,true);
  assert.equal((await command(host2,'renew',{sessionId:h2.sessionId,generation:h2.generation})).ok,true);
  assert.equal((await command(protectedPeer,'renew',{sessionId:p.sessionId,generation:p.generation})).ok,true);
 }finally{await Promise.allSettled([host1.stop(),host2.stop(),protectedPeer.stop(),server?.stop()]);}
});
