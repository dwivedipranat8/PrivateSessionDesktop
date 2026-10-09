import {lpStream} from '@libp2p/utils';
const LEASE_PROTOCOL='/private-session/account-lease/1.0.0';
/**
 * A private server-authenticated account-lease protocol.
 *
 * The caller must compare its expected RELAY PEER KEY out of band.
 * Account passphrase remains local and is never sent to the relay.
 */
export function makePinnedLeaseRequest({node,serverAddress,expectedServerPeerId,timeoutMs=8000}={}){
 if(!node||typeof serverAddress?.getComponents!=='function'||
    typeof expectedServerPeerId!=='string'||expectedServerPeerId.length<20||
    !Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>15000)
  throw Error('Pinned relay public identity required');
 return async function requestAccountLease(payload){
  if(!payload||!['begin','renew','end'].includes(payload.operation))
    throw Error('Unsupported account operation');
  // The app must not submit a password to this service.
  const frame={operation:payload.operation};
  if(payload.operation!=='begin'){
   if(typeof payload.sessionId!=='string'||payload.sessionId.length<24||
     !Number.isSafeInteger(payload.generation))
    throw Error('Session generation required');
   frame.sessionId=payload.sessionId;frame.generation=payload.generation;
  }
  const requestedAt=performance.now();
  const conn=await node.dial(serverAddress,{signal:AbortSignal.timeout(timeoutMs)});
  if(conn.remotePeer.toString()!==expectedServerPeerId){
   await conn.close();throw Error('Wrong authenticated server');
  }
  let stream;
  try{
   stream=await node.dialProtocol(conn.remotePeer,LEASE_PROTOCOL,{signal:AbortSignal.timeout(timeoutMs)});
   const framed=lpStream(stream);
   await framed.write(new TextEncoder().encode(JSON.stringify(frame)),{signal:AbortSignal.timeout(timeoutMs)});
   const data=await framed.read({signal:AbortSignal.timeout(timeoutMs)});
   if(data.length>1024)throw Error('Oversized server answer');
   const reply=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(data.subarray()));
   if(typeof reply?.ok!=='boolean')throw Error('Malformed account authorization');
   if(reply.ok&&payload.operation==='begin'&&
    (typeof reply.sessionId!=='string'||reply.sessionId.length<24||
     !['host','protected'].includes(reply.role)||!Number.isSafeInteger(reply.generation)))
    throw Error('Invalid signed-in account');
   // Local-only monotonic timestamp. Never let the server/UI supply it.
   if(payload.operation==='begin')reply.requestedAt=requestedAt;
   return reply;
  }finally{
   try{await stream?.close();}catch{}
  }
 };
}
