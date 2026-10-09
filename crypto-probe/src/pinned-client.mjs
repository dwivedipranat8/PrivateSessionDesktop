import {createLibp2p} from 'libp2p';
import {webSockets} from '@libp2p/websockets';
import {circuitRelayTransport} from '@libp2p/circuit-relay-v2';
import {identify} from '@libp2p/identify';
import {noise} from '@libp2p/noise';
import {yamux} from '@libp2p/yamux';
import {lpStream} from '@libp2p/utils';
const PROTOCOL='/private-session/pinned-noise/1.0.0',FRAME_MAX=98304,FRAME_VERSION=1;
const LEASE_PROTOCOL='/private-session/account-lease/1.0.0',
 TURN_PROTOCOL='/private-session/temporary-turn/1.0.0';
function goodId(id){return typeof id==='string'&&id.length>=20&&id.length<180&&/^[a-zA-Z0-9]+$/.test(id);}
function validateFrame(frame){
 return frame&&typeof frame==='object'&&frame.version===FRAME_VERSION&&
   typeof frame.kind==='string'&&frame.kind.length>0&&frame.kind.length<64&&
   typeof frame.sessionId==='string'&&frame.sessionId.length>=12&&
   typeof frame.sender==='string'&&goodId(frame.sender)&&
   Number.isSafeInteger(frame.seq)&&frame.seq>=1;
}
/**
 * Endpoint-to-endpoint authenticated Noise connection THROUGH a circuit relay.
 *
 * This is a transport component, not an entire messenger. Caller MUST:
 * 1) persist its own encrypted private key on the approved storage medium,
 * 2) approve a peer fingerprint in person,
 * 3) run trust + camera/mic + USB health gates before showing content,
 * 4) enforce session counters, heartbeat, read expiry and remote End.
 */
export async function createPinnedClient({privateKey,sessionId,onFrame,onSessionLost=()=>{},onConnected=()=>{},requireServerLease=true}){
 if(!privateKey||typeof sessionId!=='string'||sessionId.length<12||typeof onFrame!=='function'||typeof onConnected!=='function')
   throw Error('Approved session and device private key required');
 const node=await createLibp2p({
  privateKey,addresses:{listen:['/p2p-circuit']},
  transports:[webSockets(),circuitRelayTransport()],
  connectionEncrypters:[noise()],streamMuxers:[yamux()],
  services:{identify:identify()}
 });
 let approvedPeer=null,stream=null,framed=null,writeQueue=Promise.resolve(),ended=false,relayVerified=false,joinedRelayId=null,joinedRelayPeer=null,
  lease=null;
 function rejectPeerConnection(streamInput,reason){
  if(ended)return;
  ended=true;
  try{streamInput.abort(Error(reason));}catch{}
  try{onSessionLost(reason);}catch{}
 }
 function accept(streamInput,conn){
  if(ended||!approvedPeer||conn.remotePeer.toString()!==approvedPeer||stream){
   streamInput.abort(Error('Unapproved or duplicate peer stream'));return false;
  }
  if(requireServerLease&&!leaseActive()){streamInput.abort(Error('No active account authorization'));return false;}
  stream=streamInput;
  try{onConnected({remotePeerId:conn.remotePeer.toString()});}catch{}
  // Length-prefix messages independently of TCP/WebSocket/muxer chunks.
  // The decoder refuses oversized frames before allocating their payload.
  framed=lpStream(streamInput,{maxDataLength:FRAME_MAX,maxBufferSize:FRAME_MAX+256});
  const sourcePeer=conn.remotePeer.toString();
  (async()=>{
   try{
    while(!ended&&stream===streamInput){
     const item=await framed.read();
     if(ended)return;
     if(requireServerLease&&!leaseActive())throw Error('Server lease expired');
     const bytes=item.subarray();
     if(bytes.length===0||bytes.length>FRAME_MAX)throw Error('Invalid encrypted frame length');
     const frame=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
     if(!validateFrame(frame)||frame.sessionId!==sessionId||frame.sender!==sourcePeer)
      throw Error('Unapproved version, peer or session');
     // Await failure handlers. Never accept another frame after async denial.
     const accepted=await onFrame(frame,{noiseRemotePeerId:sourcePeer});
     if(accepted!==true)throw Error('Session frame rejected');
     if(ended)return;
    }
   }catch{
    rejectPeerConnection(streamInput,'Encrypted frame stream ended or was invalid');
   }
  })();
  return true;
 }
 await node.handle(PROTOCOL,(s,conn)=>{accept(s,conn);},{runOnLimitedConnection:true});
 function leaseActive(){
  return Boolean(lease&&performance.now()<lease.deadline&&!ended);
 }
 async function serverOperation(protocol,payload){
  if(!relayVerified||!joinedRelayId||ended)throw Error('Pinned relay connection required');
  const stream=await node.dialProtocol(joinedRelayPeer,protocol,{signal:AbortSignal.timeout(8000)});
  try{
   const framed=lpStream(stream,{maxDataLength:16000,maxBufferSize:17000});
   await framed.write(new TextEncoder().encode(JSON.stringify(payload)),{signal:AbortSignal.timeout(8000)});
   const raw=(await framed.read({signal:AbortSignal.timeout(8000)})).subarray();
   if(raw.length===0||raw.length>16000)throw Error('Malformed relay reply');
   const answer=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
   if(!answer||typeof answer!=='object')throw Error('Malformed relay reply');
   return answer;
  }finally{try{await stream.close();}catch{}}
 }
 async function renewLease(){
  if(!leaseActive())throw Error('Local account lease expired');
  const ref=lease;
  const started=performance.now();
  const result=await serverOperation(LEASE_PROTOCOL,{operation:'renew',sessionId:ref.sessionId,generation:ref.generation});
  if(lease!==ref||!result.ok||result.role!==ref.role||result.generation!==ref.generation||
     result.expiresInMs!==3000||performance.now()>=started+result.expiresInMs)
    throw Error('Account renewal refused or stale');
  lease={...ref,deadline:started+result.expiresInMs};
  return {role:lease.role,expiresInMs:result.expiresInMs};
 }
 return Object.freeze({
  get peerId(){return node.peerId.toString();},
  get approvedPeerId(){return approvedPeer;},
  get connected(){return Boolean(stream&&!ended&&(!requireServerLease||leaseActive()));},
  get leaseHealthy(){return leaseActive();},
  async beginLease(expectedRole){
   if(!['host','protected'].includes(expectedRole))throw Error('Local approved account role required');
   const requestedAt=performance.now();
   const result=await serverOperation(LEASE_PROTOCOL,{operation:'begin'});
   if(!result.ok||result.role!==expectedRole||!Number.isSafeInteger(result.generation)||
      typeof result.sessionId!=='string'||result.sessionId.length<24||
      !Number.isInteger(result.expiresInMs)||result.expiresInMs<1000||result.expiresInMs>3000||
      performance.now()>=requestedAt+result.expiresInMs)
    throw Error('Enrolled device authorization unavailable');
   lease={role:expectedRole,sessionId:result.sessionId,generation:result.generation,
    deadline:requestedAt+result.expiresInMs};
   return {role:expectedRole,generation:lease.generation,expiresInMs:result.expiresInMs};
  },
  renewLease,
  async getTemporaryTurn(){
   if(!leaseActive())throw Error('Account authorization expired');
   const current=lease;
   const result=await serverOperation(TURN_PROTOCOL,
      {sessionId:current.sessionId,generation:current.generation});
   if(!leaseActive()||lease!==current)throw Error('Account authorization changed');
   if(!result||!Array.isArray(result.iceServers)||result.iceServers.length===0)
     throw Error('Valid encrypted TURN configuration unavailable');
   return result;
  },
  get joinedRelayId(){return joinedRelayId;},
  get relayedAddresses(){return node.getMultiaddrs().filter(a=>a.toString().includes('/p2p-circuit/'));},
  approvePeer(peerId){
   if(ended||stream||approvedPeer||!goodId(peerId)||peerId===node.peerId.toString())
    throw Error('Explicit in-person peer approval required before connection');
   approvedPeer=peerId;
  },
  async joinRelay(address,relayId){
   if(ended||!approvedPeer||!goodId(relayId)||typeof address?.getComponents!=='function')
    throw Error('Pinned relay identity and approved peer required');
   const conn=await node.dial(address,{signal:AbortSignal.timeout(10000)});
   if(conn.remotePeer.toString()!==relayId){
    await conn.close();throw Error('Unapproved relay identity');
   }
   joinedRelayId=relayId;joinedRelayPeer=conn.remotePeer;relayVerified=true;
   return true;
  },
  async connect(remoteCircuitAddress){
   if(ended||!relayVerified||(requireServerLease&&!leaseActive())||!approvedPeer||stream||typeof remoteCircuitAddress?.getComponents!=='function'||
      !remoteCircuitAddress.toString().includes('/p2p-circuit/p2p/'+approvedPeer))
    throw Error('No approved relayed destination');
   const conn=await node.dial(remoteCircuitAddress,{signal:AbortSignal.timeout(10000)});
   if(conn.remotePeer.toString()!==approvedPeer)throw Error('Wrong authenticated remote identity');
   const outbound=await conn.newStream(PROTOCOL,{signal:AbortSignal.timeout(10000),runOnLimitedConnection:true});
   if(!accept(outbound,conn))throw Error('Peer stream refused');
   return true;
  },
  async send(frame){
   if(ended||(requireServerLease&&!leaseActive())||!stream||!framed||!approvedPeer||!frame||frame.sender!==node.peerId.toString()||
      frame.sessionId!==sessionId)return false;
   const envelope={...frame,version:FRAME_VERSION};
   if(!validateFrame(envelope))return false;
   const bytes=new TextEncoder().encode(JSON.stringify(envelope));
   if(bytes.length===0||bytes.length>FRAME_MAX)return false;
   // Serialize writes and respect backpressure rather than assuming
   // stream.send returned true or preserved application message boundaries.
   const job=writeQueue.then(async()=>{
    if(ended||!framed)throw Error('Encrypted stream closed');
    await framed.write(bytes,{signal:AbortSignal.timeout(8000)});
    return true;
   });
   writeQueue=job.catch(()=>{});
   try{return await job;}catch{
    if(stream)rejectPeerConnection(stream,'Encrypted stream write failed');
    return false;
   }
  },
  async end(){
   if(ended){await node.stop();return;}
   ended=true;lease=null;
   try{await stream?.close();}catch{}
   await node.stop();stream=null;framed=null;
  }
 });
}
