import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLibp2p} from 'libp2p';
import {tcp} from '@libp2p/tcp';
import {noise} from '@libp2p/noise';
import {yamux} from '@libp2p/yamux';
import secureControl from '../../core/secure-control.cjs';
import receiptModule from '../../core/read-receipts.cjs';
const {SecureControl}=secureControl;
const {ReadReceipts}=receiptModule;
test('pinned Noise identities carry Seen and Clear & End in a dummy call',{timeout:30000},async()=>{
  const make=()=>createLibp2p({
   addresses:{listen:['/ip4/127.0.0.1/tcp/0']},
   transports:[tcp()],connectionEncrypters:[noise()],streamMuxers:[yamux()]
  });
  const host=await make(),guest=await make();
  const hostDevice=host.peerId.toString(),guestDevice=guest.peerId.toString();
  const sessionId='session_for_dummy_only_123';
  const messageId='message_for_dummy_1234';
  let now=1000,guestPlaintext=null,guestDeleted=false,hostSawSeen=false;
  const receipts=new ReadReceipts({sessionId,clock:()=>now});
  receipts.send(messageId,guestDevice);
  const onHost=new SecureControl({
   sessionId,approvedRemoteDevice:guestDevice,hostDeviceId:hostDevice,localDeviceId:hostDevice,
   onSeen:id=>{
    hostSawSeen=receipts.seen({sessionId,id,deviceId:guestDevice},{authenticated:true});
   }
  });
  const onGuest=new SecureControl({
   sessionId,approvedRemoteDevice:hostDevice,hostDeviceId:hostDevice,localDeviceId:guestDevice,
   onText:(_id,text)=>{guestPlaintext=text;},
   onClearEnd:()=>{guestPlaintext=null;guestDeleted=true;}
  });
  let ackResolve,deleteResolve, fail;
  const ack=new Promise((r,j)=>{ackResolve=r;fail=j;});
  const deleted=new Promise(r=>{deleteResolve=r;});
  const protocol='/private-session/secure-control-smoke/1.0.0';
  const encode=v=>new TextEncoder().encode(JSON.stringify(v));
  try{
   guest.handle(protocol,(stream,connection)=>{
    // Derive identity from Noise handshake, not untrusted message sender.
    if(connection.remotePeer.toString()!==hostDevice){stream.abort(Error('Wrong approved peer'));return;}
    stream.addEventListener('message',evt=>{
     try{
      const frame=JSON.parse(new TextDecoder().decode(evt.data.subarray()));
      if(!onGuest.receive(frame,{noiseRemoteDeviceId:connection.remotePeer.toString()}))
       throw Error('Guest refused control frame');
      if(frame.kind==='text'){
       stream.send(encode({kind:'seen',seq:1,sessionId,sender:guestDevice,messageId}));
      }else if(frame.kind==='clear_end')deleteResolve();
     }catch(err){fail(err);}
    });
   });
   const addr=guest.getMultiaddrs().find(a=>a.toString().includes('127.0.0.1'));
   assert.ok(addr);
   const connection=await host.dial(addr,{signal:AbortSignal.timeout(8000)});
   assert.equal(connection.remotePeer.toString(),guestDevice);
   const stream=await host.dialProtocol(guest.peerId,protocol,{signal:AbortSignal.timeout(8000)});
   stream.addEventListener('message',evt=>{
    try{
     const frame=JSON.parse(new TextDecoder().decode(evt.data.subarray()));
     if(!onHost.receive(frame,{noiseRemoteDeviceId:connection.remotePeer.toString()}))
      throw Error('Host rejected authenticated Seen');
     ackResolve();
    }catch(err){fail(err);}
   });
   stream.send(encode({kind:'text',sessionId,sender:hostDevice,seq:1,messageId,text:'DUMMY-CONTENT'}));
   await Promise.race([ack,new Promise((_r,j)=>setTimeout(()=>j(Error('Seen timeout')),8000))]);
   assert.equal(guestPlaintext,'DUMMY-CONTENT');
   assert.equal(hostSawSeen,true);
   now+=119999;assert.deepEqual(receipts.expire(),[]);
   now+=1;assert.deepEqual(receipts.expire(),[messageId]);
   stream.send(encode({kind:'clear_end',requestId:'secure_clear_req_12345',sessionId,sender:hostDevice,seq:2}));
   await Promise.race([deleted,new Promise((_r,j)=>setTimeout(()=>j(Error('Delete timeout')),8000))]);
   assert.equal(guestDeleted,true);assert.equal(guestPlaintext,null);
   await stream.close();
  }finally{await Promise.allSettled([host.stop(),guest.stop()]);}
});
