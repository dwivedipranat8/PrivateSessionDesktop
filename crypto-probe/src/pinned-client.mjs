import {createLibp2p} from 'libp2p';
import {webSockets} from '@libp2p/websockets';
import {circuitRelayTransport} from '@libp2p/circuit-relay-v2';
import {identify} from '@libp2p/identify';
import {noise} from '@libp2p/noise';
import {yamux} from '@libp2p/yamux';
import {lpStream} from '@libp2p/utils';
const PROTOCOL='/private-session/pinned-noise/1.0.0',FRAME_MAX=98304,FRAME_VERSION=1;
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
export async function createPinnedClient({privateKey,sessionId,onFrame,onSessionLost=()=>{}}){
 if(!privateKey||typeof sessionId!=='string'||sessionId.length<12||typeof onFrame!=='function')
   throw Error('Approved session and device private key required');
 const node=await createLibp2p({
  privateKey,addresses:{listen:['/p2p-circuit']},
  transports:[webSockets(),circuitRelayTransport()],
  connectionEncrypters:[noise()],streamMuxers:[yamux()],
  services:{identify:identify()}
 });
 let approvedPeer=null,stream=null,framed=null,writeQueue=Promise.resolve(),ended=false,relayVerified=false,joinedRelayId=null;
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
  stream=streamInput;
  // Length-prefix messages independently of TCP/WebSocket/muxer chunks.
  // The decoder refuses oversized frames before allocating their payload.
  framed=lpStream(streamInput,{maxDataLength:FRAME_MAX,maxBufferSize:FRAME_MAX+256});
  const sourcePeer=conn.remotePeer.toString();
  (async()=>{
   try{
    while(!ended&&stream===streamInput){
     const item=await framed.read();
     if(ended)return;
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
 return Object.freeze({
  get peerId(){return node.peerId.toString();},
  get approvedPeerId(){return approvedPeer;},
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
   joinedRelayId=relayId;relayVerified=true;
   return true;
  },
  async connect(remoteCircuitAddress){
   if(ended||!relayVerified||!approvedPeer||stream||typeof remoteCircuitAddress?.getComponents!=='function'||
      !remoteCircuitAddress.toString().includes('/p2p-circuit/p2p/'+approvedPeer))
    throw Error('No approved relayed destination');
   const conn=await node.dial(remoteCircuitAddress,{signal:AbortSignal.timeout(10000)});
   if(conn.remotePeer.toString()!==approvedPeer)throw Error('Wrong authenticated remote identity');
   const outbound=await conn.newStream(PROTOCOL,{signal:AbortSignal.timeout(10000),runOnLimitedConnection:true});
   if(!accept(outbound,conn))throw Error('Peer stream refused');
   return true;
  },
  async send(frame){
   if(ended||!stream||!framed||!approvedPeer||!frame||frame.sender!==node.peerId.toString()||
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
   ended=true;
   try{await stream?.close();}catch{}
   await node.stop();stream=null;framed=null;
  }
 });
}
