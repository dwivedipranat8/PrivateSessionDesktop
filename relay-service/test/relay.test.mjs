import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLibp2p} from 'libp2p';
import {webSockets} from '@libp2p/websockets';
import {noise} from '@libp2p/noise';
import {yamux} from '@libp2p/yamux';
import {generateKeyPair} from '@libp2p/crypto/keys';
import {lpStream} from '@libp2p/utils';
import {createPrivateRelay} from '../src/server.mjs';

test('only Noise-authorized endpoint obtains temporary TURN credentials',{timeout:30000},async()=>{
 const credentials={iceServers:[{urls:['turns:relay.example:5349'],username:'demo',credential:'test-only'}]};
 const privateKey=await generateKeyPair('Ed25519');
 const client=await createLibp2p({
  addresses:{listen:[]},transports:[webSockets()],
  connectionEncrypters:[noise()],streamMuxers:[yamux()]
 });
 const enrolled=new Map([[client.peerId.toString(),'partner']]);
 let service=null;
 try{
  service=await createPrivateRelay({privateKey,enrolled,issuer:async(id)=>{
   assert.equal(id,client.peerId.toString());return credentials;
  },port:0,host:'127.0.0.1'});
  const address=service.getMultiaddrs().find(x=>x.toString().includes('127.0.0.1'));
  assert.ok(address);
  const connection=await client.dial(address,{signal:AbortSignal.timeout(8000)});
  assert.equal(connection.remotePeer.toString(),service.peerId.toString());
  const stream=await client.dialProtocol(service.peerId,'/private-session/temporary-turn/1.0.0',{
   signal:AbortSignal.timeout(8000)
  });
  const lp=lpStream(stream);
  const received=await lp.read({signal:AbortSignal.timeout(8000)});
  assert.deepEqual(JSON.parse(new TextDecoder().decode(received.subarray())),credentials);
  await stream.close();
 }finally{
  await Promise.allSettled([client.stop(),service?.stop()]);
 }
});
