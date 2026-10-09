import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,privateKeyToProtobuf} from '@libp2p/crypto/keys';
import {createDesktopChat} from '../src/desktop-chat.mjs';
const local='12D3KooWAAAAAAAAAAAAAAAAAAAAAAAAA';
const remote='12D3KooWBBBBBBBBBBBBBBBBBBBBBBBBB';
const relay='12D3KooWCCCCCCCCCCCCCCCCCCCCCCCCC';
const SESSION='test_session_00123456789';
function fakeFactory(){
 const sent=[];
 const fake={peerId:local,leaseHealthy:true,connected:false,
  relayedAddresses:[{toString:()=>'/ip4/127.0.0.1/tcp/12345/ws/p2p/'+relay+'/p2p-circuit/p2p/'+local}],
  approvePeer(x){if(x!==remote)throw Error('not approved');},
  async joinRelay(_a,id){if(id!==relay)throw Error('wrong relay');},
  async beginLease(role){this.role=role;},
  async renewLease(){return {role:'host'};},
  async connect(){this.connected=true;this.connectedCb();},
  async send(frame){sent.push(frame);return true;},
  async end(){this.connected=false;this.ended=true;},
  async getTemporaryTurn(){return {iceServers:[{urls:'turns:relay.invalid',username:'temporary',credential:'temporary'}]};}
 };
 return {sent,factory:async opts=>{fake.connectedCb=()=>opts.onConnected({remotePeerId:remote});return fake;},fake};
}
test('real desktop controller refuses chat until account and peer proof are verified',{timeout:30000},async()=>{
 const key=await generateKeyPair('Ed25519'),s=fakeFactory();
 const c=await createDesktopChat({privateKeyBytes:privateKeyToProtobuf(key),
  role:'host',relayAddress:'/ip4/127.0.0.1/tcp/12345/ws/p2p/'+relay,
  relayPeerId:relay,approvedPeerId:remote,sessionId:SESSION,clientFactory:s.factory});
 assert.equal(c.connected,false);
 await assert.rejects(c.sendText('not authorized'));
 await c.connect('/ip4/127.0.0.1/tcp/12345/ws/p2p/'+relay+'/p2p-circuit/p2p/'+remote);
 assert.equal(c.connected,false);
 await c.close();
 assert.equal(s.fake.ended,true);
});
test('never report remote deletion confirmed just because a control write returned true',{timeout:30000},async()=>{
 const key=await generateKeyPair('Ed25519'),s=fakeFactory();
 const events=[];
 const c=await createDesktopChat({privateKeyBytes:privateKeyToProtobuf(key),
  role:'host',relayAddress:'/ip4/127.0.0.1/tcp/12345/ws/p2p/'+relay,
  relayPeerId:relay,approvedPeerId:remote,sessionId:SESSION,clientFactory:s.factory,
  onEvent:x=>events.push(x)});
 await c.connect('/ip4/127.0.0.1/tcp/12345/ws/p2p/'+relay+'/p2p-circuit/p2p/'+remote);
 const result=await c.clearAndEnd();
 assert.equal(result.localCleared,true);
 assert.equal(result.peerConfirmed,false);
 assert.ok(events.some(x=>x.type==='cleared'));
});
