import {createLibp2p} from 'libp2p';
import {webSockets} from '@libp2p/websockets';
import {circuitRelayTransport} from '@libp2p/circuit-relay-v2';
import {identify} from '@libp2p/identify';
import {noise} from '@libp2p/noise';
import {yamux} from '@libp2p/yamux';
const PROTOCOL='/private-session/pinned-noise/1.0.0',FRAME_MAX=8192;
function goodId(id){return typeof id==='string'&&id.length>=20&&id.length<180&&/^[a-zA-Z0-9]+$/.test(id);}
function validateFrame(frame){
 return frame&&typeof frame==='object'&&typeof frame.kind==='string'&&
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
 let approvedPeer=null,stream=null,ended=false,relayVerified=false,joinedRelayId=null;
 function accept(streamInput,conn){
  if(ended||!approvedPeer||conn.remotePeer.toString()!==approvedPeer||stream){
   streamInput.abort(Error('Unapproved or duplicate peer stream'));return false;
  }
  stream=streamInput;
  stream.addEventListener('message',e=>{
   if(ended)return;
   try{
    const bytes=e.data.subarray();
    if(bytes.length===0||bytes.length>FRAME_MAX)throw Error('Encrypted frame too large');
    const frame=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(!validateFrame(frame)||frame.sessionId!==sessionId||frame.sender!==approvedPeer)
      throw Error('Wrong session/identity');
    // Only actual Noise-authenticated peer identity is passed to app.
    onFrame(frame,{noiseRemotePeerId:conn.remotePeer.toString()});
   }catch{
    ended=true;onSessionLost('Malformed or unapproved encrypted frame');
    try{streamInput.abort(Error('Invalid encrypted frame'));}catch{}
   }
  });
  return true;
 }
 await node.handle(PROTOCOL,(s,conn)=>{accept(s,conn);});
 return Object.freeze({
  get peerId(){return node.peerId.toString();},
  get approvedPeerId(){return approvedPeer;},
  get joinedRelayId(){return joinedRelayId;},
  get relayedAddresses(){return node.getMultiaddrs().map(a=>a.toString()).filter(x=>x.includes('/p2p-circuit/'));},
  approvePeer(peerId){
   if(ended||stream||approvedPeer||!goodId(peerId)||peerId===node.peerId.toString())
    throw Error('Explicit in-person peer approval required before connection');
   approvedPeer=peerId;
  },
  async joinRelay(address,relayId){
   if(ended||!approvedPeer||!goodId(relayId)||typeof address!=='string')
    throw Error('Pinned relay identity and approved peer required');
   const conn=await node.dial(address,{signal:AbortSignal.timeout(10000)});
   if(conn.remotePeer.toString()!==relayId){
    await conn.close();throw Error('Unapproved relay identity');
   }
   joinedRelayId=relayId;relayVerified=true;
   return true;
  },
  async connect(remoteCircuitAddress){
   if(ended||!relayVerified||!approvedPeer||stream||typeof remoteCircuitAddress!=='string'||
      !remoteCircuitAddress.includes('/p2p-circuit/p2p/'+approvedPeer))
    throw Error('No approved relayed destination');
   const conn=await node.dial(remoteCircuitAddress,{signal:AbortSignal.timeout(10000)});
   if(conn.remotePeer.toString()!==approvedPeer)throw Error('Wrong authenticated remote identity');
   const outbound=await node.dialProtocol(conn.remotePeer,PROTOCOL,{signal:AbortSignal.timeout(10000)});
   if(!accept(outbound,conn))throw Error('Peer stream refused');
   return true;
  },
  send(frame){
   if(ended||!stream||!approvedPeer||!validateFrame(frame)||frame.sender!==node.peerId.toString()||
      frame.sessionId!==sessionId)return false;
   const bytes=new TextEncoder().encode(JSON.stringify(frame));
   if(bytes.length>FRAME_MAX)return false;
   stream.send(bytes);return true;
  },
  async end(){
   if(ended){await node.stop();return;}
   ended=true;
   try{await stream?.close();}catch{}
   await node.stop();stream=null;
  }
 });
}
