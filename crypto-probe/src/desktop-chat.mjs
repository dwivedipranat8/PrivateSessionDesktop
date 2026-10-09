import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {privateKeyFromProtobuf} from '@libp2p/crypto/keys';
import {multiaddr} from '@multiformats/multiaddr';
import {createPinnedClient} from './pinned-client.mjs';
const require=createRequire(import.meta.url);
const {SecureFrameRouter}=require('../../core/secure-frame-router.cjs');
const {SecureControl}=require('../../core/secure-control.cjs');
const {ReadReceipts}=require('../../core/read-receipts.cjs');
const {PeerLease}=require('../../core/peer-lease.cjs');

const PEER_ID=/^[a-zA-Z0-9]{20,180}$/,SESSION_ID=/^[A-Za-z0-9_-]{16,150}$/;
/**
 * Experimental desktop text-session adapter. It performs real authenticated
 * E2EE operations but intentionally cannot bypass capture and USB release gates.
 * Deployer must run a STATIC-identity allowlisted relay and distribute its pin.
 */
export async function createDesktopChat({
  privateKeyBytes,role,relayAddress,relayPeerId,approvedPeerId,sessionId,
  onEvent=()=>{},clientFactory=createPinnedClient,clock=()=>performance.now()
}={}){
 if(!privateKeyBytes||!['host','protected'].includes(role)||!PEER_ID.test(relayPeerId||'')||
  !PEER_ID.test(approvedPeerId||'')||!SESSION_ID.test(sessionId||'')||
  typeof relayAddress!=='string'||!relayAddress.startsWith('/')||
  typeof onEvent!=='function')throw Error('Pinned enrollment and local identity required');
 const identity=privateKeyFromProtobuf(privateKeyBytes);
 let ended=false,connected=false,peerLease=null,router=null,control=null;
 let interval=null,renewing=false,lastRenew=clock(),lastChallenge=0;
 const incoming=new Map();
 const receipts=new ReadReceipts({sessionId,clock});
 const event=e=>{if(ended&&e.type!=='closed')return;try{onEvent(e);}catch{}};
 let client;
 function fail(reason){
  if(ended)return;
  // Stop exposing content before any asynchronous network teardown.
  event({type:'cleared'});
  ended=true;
  if(interval)clearInterval(interval);
  incoming.clear();receipts.clear();
  event({type:'closed',reason:'Security/session connection terminated'});
  Promise.resolve(client?.end()).catch(()=>{});
 }
 function beginPeerProof(){
  peerLease=new PeerLease({sessionId,clock,onProtect:()=>event({type:'conceal'}),
   onExpire:()=>fail('Peer heartbeat expired')});
  connected=true;
  event({type:'peer-connected'});
 }
 function guard(){
  if(ended||!client||!client.leaseHealthy||!client.connected||!peerLease?.active){
   if(client?.connected&&peerLease&&['protected','expired'].includes(peerLease.phase))fail('Peer heartbeat not current');
   return false;
  }
  return true;
 }
 async function send(channel,payload){
  if(!router||ended)return false;
  return router.send(channel,payload);
 }
 const lastReceipt=new Map();
 function handleReceivedText(id,text){
  if(ended||!guard())return false;
  if(typeof id!=='string'||id.length<12||typeof text!=='string')return false;
  if(incoming.has(id))return false;
  incoming.set(id,{created:clock(),seen:null});
  event({type:'incoming',id,text});
  return true;
 }
 async function respondHeartbeat(frame){
  if(ended||!connected)return false;
  if(frame.kind==='challenge'){
   if(typeof frame.token!=='string'||frame.token.length<20)return false;
   return send('heartbeat',{kind:'response',token:frame.token});
  }
  if(frame.kind==='response'){
   const old=peerLease?.active===true;
   const accepted=peerLease?.accept({...frame,sessionId},{authenticated:true})===true;
   if(accepted&&!old)event({type:'ready'});
   return accepted;
  }
  return false;
 }
 const output=async(frame,meta)=>router?.receive(frame,meta)??false;
 client=await clientFactory({privateKey:identity,sessionId,onFrame:output,
  onConnected:beginPeerProof,onSessionLost:fail,requireServerLease:true});
 if(client.peerId===approvedPeerId){await client.end();throw Error('Self-peer forbidden');}
 router=new SecureFrameRouter({
  sessionId,localPeerId:client.peerId,remotePeerId:approvedPeerId,
  sendAuthenticated:frame=>client.send(frame),
  onFailure:fail,
  onControl:(frame,meta)=>control.receive(frame,meta),
  onHeartbeat:respondHeartbeat,
  onRtc:async frame=>{
   if(!guard())return false;
   event({type:'rtc-signal',frame});return true;
  }
 });
 control=new SecureControl({
  sessionId,approvedRemoteDevice:approvedPeerId,hostDeviceId:role==='host'?client.peerId:approvedPeerId,
  localDeviceId:client.peerId,
  onText:handleReceivedText,
  onSeen:id=>{
   if(!guard())return;
   if(receipts.seen({sessionId,id,deviceId:approvedPeerId},{authenticated:true}))
    event({type:'seen',id,expiresAt:receipts.expiresAt(id)});
  },
  onClearEnd:requestId=>{
   event({type:'cleared'});
   void send('control',{kind:'clear_ack',requestId}).finally(()=>fail('Peer Clear & End'));
  },
  onClearAck:id=>{if(lastReceipt.has(id))lastReceipt.get(id)(true);},
  onEnd:()=>{event({type:'cleared'});fail('Peer ended');},
  onSecurityFailure:()=>fail('Peer trust failed')
 });
 try{
  client.approvePeer(approvedPeerId);
  await client.joinRelay(multiaddr(relayAddress),relayPeerId);
  await client.beginLease(role);
 }catch(error){await client.end();throw error;}
 async function tick(){
  if(ended)return;
  const now=clock();
  if(!client.leaseHealthy){fail('Server account expired');return;}
  if(now-lastRenew>=1000&&!renewing){
   renewing=true;lastRenew=now;
   try{await client.renewLease();}
   catch{fail('Server authorization lost');}
   finally{renewing=false;}
  }
  if(!connected)return;
  peerLease.tick();
  if(ended)return;
  if(now-lastChallenge>=500){
   lastChallenge=now;
   const challenge=peerLease.challenge();
   if(challenge&&!await send('heartbeat',challenge))fail('Peer challenge failed');
  }
  for(const [id,entry] of incoming){
   const deadline=(entry.seen??entry.created)+120000;
   if(now>=deadline){incoming.delete(id);event({type:'expired',id});}
  }
  for(const id of receipts.expire())event({type:'expired',id});
 }
 interval=setInterval(()=>void tick(),250);
 interval.unref?.();
 return Object.freeze({
  get localPeerId(){return client.peerId;},
  get connected(){return !ended&&guard();},
  get ownCircuitAddresses(){return client.relayedAddresses.map(a=>a.toString());},
  async connect(circuitAddress){
   if(ended||!client.leaseHealthy)throw Error('Not authorized');
   await client.connect(multiaddr(circuitAddress));
   return true;
  },
  async sendText(text){
   if(!guard()||typeof text!=='string'||text.length<1||text.length>2048)throw Error('Encrypted chat not authorized');
   const id=randomBytes(18).toString('base64url');
   receipts.send(id,approvedPeerId);
   if(!await send('control',{kind:'text',messageId:id,text})){
    receipts.clear();fail('Encrypted send failed');throw Error('Encrypted transport failed');
   }
   return {id,expiresAt:receipts.expiresAt(id)};
  },
  async reportDisplayed(id){
   if(!guard()||!incoming.has(id))return false;
   const entry=incoming.get(id),now=clock();
   if(entry.seen!==null||now>=entry.created+120000)return false;
   entry.seen=now;
   const result=await send('control',{kind:'seen',messageId:id});
   if(!result)fail('Seen receipt could not be delivered');
   return result;
  },
  async clearAndEnd(){
   if(ended)return false;
   event({type:'cleared'});
   // Conceal first. Give a short opportunity for authenticated Clear ACK, but
   // never misreport an encrypted write as proof that the other peer erased.
   const id=randomBytes(24).toString('base64url');
   let resolveAck,confirmed=false;
   const ack=new Promise(resolve=>{resolveAck=resolve;});
   lastReceipt.set(id,resolveAck);
   let delivered=false;
   try{
    if(connected){
     const write=send('control',{kind:'clear_end',requestId:id});
     const timeout=new Promise(resolve=>setTimeout(()=>resolve(false),250));
     delivered=await Promise.race([write,timeout])===true;
     if(delivered){
      confirmed=await Promise.race([ack,new Promise(resolve=>setTimeout(()=>resolve(false),250))])===true;
     }
    }
    return {localCleared:true,peerDeliveryAttempted:delivered,peerConfirmed:confirmed};
   }finally{
    lastReceipt.delete(id);
    fail('Local Clear & End');
   }
  },
  async sendRtcSignal(frame){
   if(!guard()||!frame||!['offer','answer','candidate','end'].includes(frame.kind))
    return false;
   const payload={kind:frame.kind};
   if(frame.kind==='offer'||frame.kind==='answer'){
    if(typeof frame.sdp!=='string'||frame.sdp.length>64000||frame.sdp.length<20)return false;
    payload.sdp=frame.sdp;
   }
   if(frame.kind==='candidate'){
    if(typeof frame.candidate?.candidate!=='string'||frame.candidate.candidate.length>8192)return false;
    payload.candidate=frame.candidate;
   }
   return send('rtc',payload);
  },
  get peerIdForRtc(){return approvedPeerId;},
  async close(){fail('Local stop');},
  async getTurnConfig(){if(!guard())throw Error('Not authorized for video');return client.getTemporaryTurn();}
 });
}
