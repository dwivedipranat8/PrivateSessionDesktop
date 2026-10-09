import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLibp2p} from 'libp2p';
import {tcp} from '@libp2p/tcp';
import {noise} from '@libp2p/noise';
import {yamux} from '@libp2p/yamux';
test('authenticated Noise test stream between two nodes',{timeout:30000},async()=>{
 const make=()=>createLibp2p({
   addresses:{listen:['/ip4/127.0.0.1/tcp/0']},
   transports:[tcp()],connectionEncrypters:[noise()],streamMuxers:[yamux()]
 });
 const a=await make(),b=await make();
 try{
   assert.notEqual(a.peerId.toString(),b.peerId.toString());
   const protocol='/private-session/dummy-noise/1.0.0';
   let resolve,reject;
   const response=new Promise((ok,bad)=>{resolve=ok;reject=bad;});
   a.handle(protocol,stream=>{
     stream.addEventListener('message',ev=>{
       try{
         assert.equal(new TextDecoder().decode(ev.data.subarray()),'TEST-HELLO');
         stream.send(new TextEncoder().encode('TEST-ACK'));
       }catch(err){reject(err);}
     });
   });
   const loopback=a.getMultiaddrs().find(addr=>addr.toString().includes('127.0.0.1'));
   assert.ok(loopback);
   const conn=await b.dial(loopback,{signal:AbortSignal.timeout(10000)});
   assert.equal(conn.remotePeer.toString(),a.peerId.toString());
   const stream=await b.dialProtocol(a.peerId,protocol,{signal:AbortSignal.timeout(10000)});
   stream.addEventListener('message',ev=>resolve(new TextDecoder().decode(ev.data.subarray())));
   stream.send(new TextEncoder().encode('TEST-HELLO'));
   const answer=await Promise.race([response,new Promise((_r,bad)=>setTimeout(()=>bad(new Error('Timed out')),10000))]);
   assert.equal(answer,'TEST-ACK');
   await stream.close();
 }finally{await Promise.allSettled([b.stop(),a.stop()]);}
});
