import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLibp2p} from 'libp2p';
import {webSockets} from '@libp2p/websockets';
import {circuitRelayServer,circuitRelayTransport} from '@libp2p/circuit-relay-v2';
import {identify} from '@libp2p/identify';
import {noise} from '@libp2p/noise';
import {yamux} from '@libp2p/yamux';

const PROTO='/private-session/relay-smoke/1.0.0';
const timeout=ms=>new Promise((_r,reject)=>setTimeout(()=>reject(Error('Relayed handshake timed out')),ms));

test('two separately authenticated peers communicate through third-party relay',{timeout:45000},async()=>{
 const relay=await createLibp2p({
  addresses:{listen:['/ip4/127.0.0.1/tcp/0/ws']},
  transports:[webSockets()],connectionEncrypters:[noise()],streamMuxers:[yamux()],
  services:{identify:identify(),relay:circuitRelayServer()}
 });
 const newClient=()=>createLibp2p({
  addresses:{listen:['/p2p-circuit']},
  transports:[webSockets(),circuitRelayTransport()],
  connectionEncrypters:[noise()],streamMuxers:[yamux()],
  services:{identify:identify()}
 });
 const sender=await newClient(),receiver=await newClient();
 const relayAddress=relay.getMultiaddrs().find(a=>a.toString().includes('127.0.0.1'));
 assert.ok(relayAddress);
 try{
  let completed;
  const ack=new Promise(resolve=>{completed=resolve;});
  receiver.handle(PROTO,(stream,connection)=>{
   // The sender must be authenticated by the inner Noise connection.
   if(connection.remotePeer.toString()!==sender.peerId.toString()){
    stream.abort(Error('Unknown peer'));return;
   }
   stream.addEventListener('message',event=>{
    const value=new TextDecoder().decode(event.data.subarray());
    if(value==='DUMMY-RELAY-HELLO')stream.send(new TextEncoder().encode('DUMMY-RELAY-ACK'));
   });
  });
  await sender.dial(relayAddress,{signal:AbortSignal.timeout(8000)});
  await receiver.dial(relayAddress,{signal:AbortSignal.timeout(8000)});
  // The receiver needs an active circuit reservation on the relay.
  let reserved=null;
  for(let i=0;i<80;i++){
   reserved=receiver.getMultiaddrs().find(a=>a.toString().includes('/p2p-circuit/'));
   if(reserved)break;
   await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(reserved,'No relayed multiaddress became available');
  const connection=await sender.dial(reserved,{signal:AbortSignal.timeout(10000)});
  assert.equal(connection.remotePeer.toString(),receiver.peerId.toString());
  const stream=await sender.dialProtocol(receiver.peerId,PROTO,{signal:AbortSignal.timeout(10000)});
  stream.addEventListener('message',event=>completed(new TextDecoder().decode(event.data.subarray())));
  stream.send(new TextEncoder().encode('DUMMY-RELAY-HELLO'));
  assert.equal(await Promise.race([ack,timeout(10000)]),'DUMMY-RELAY-ACK');
  await stream.close();
 }finally{
  await Promise.allSettled([sender.stop(),receiver.stop(),relay.stop()]);
 }
});
