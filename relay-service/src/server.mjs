import {createLibp2p} from 'libp2p';
import {webSockets} from '@libp2p/websockets';
import {noise} from '@libp2p/noise';
import {yamux} from '@libp2p/yamux';
import {circuitRelayServer} from '@libp2p/circuit-relay-v2';
import {identify} from '@libp2p/identify';
import {privateKeyFromProtobuf} from '@libp2p/crypto/keys';
import {lpStream} from '@libp2p/utils';
import {parseEnrolled,admit,permittedPair} from './policy.mjs';
import {makeTurnIssuer} from './turn.mjs';

const TURN_PROTOCOL='/private-session/temporary-turn/1.0.0';

/*
 * A restricted libp2p relay and authenticated TURN-credential endpoint.
 * It does not own or decrypt endpoint-to-endpoint chat and video keys.
 * Environment must contain the static server identity and device allowlist.
 */
export async function createPrivateRelay({privateKey,enrolled,issuer,port=0,host='127.0.0.1',announceHost=null}){
 if(!privateKey||!(enrolled instanceof Map)||enrolled.size<1||typeof issuer!=='function')
  throw Error('Static identity, enrollment and credential issuer required');
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid listener port');
 const addresses={listen:['/ip4/'+host+'/tcp/'+port+'/ws']};
 if(announceHost){
  if(!/^[a-z0-9][a-z0-9.-]{0,200}$/i.test(announceHost))throw Error('Invalid announce host');
  addresses.announce=['/dns4/'+announceHost+'/tcp/443/tls/ws'];
 }
 const node=await createLibp2p({
  privateKey,addresses,transports:[webSockets()],
  connectionEncrypters:[noise()],streamMuxers:[yamux()],
  connectionGater:{
   denyInboundEncryptedConnection:peer=>!admit(enrolled,peer.toString()),
   denyInboundRelayReservation:peer=>!admit(enrolled,peer.toString()),
   denyOutboundRelayedConnection:(src,dst)=>!permittedPair(enrolled,src.toString(),dst.toString())
  },
  services:{
   identify:identify(),
   relay:circuitRelayServer({advertise:true,reservations:{
    maxReservations:8,reservationClearInterval:300000,
    applyDefaultLimit:true,defaultDurationLimit:65*60*1000,
    defaultDataLimit:BigInt(128*1024*1024)
   }})
  }
 });
 await node.handle(TURN_PROTOCOL,async(stream,connection)=>{
  // Only a peer already authenticated by Noise can reach the protocol.
  const authenticatedPeer=connection.remotePeer.toString();
  if(!admit(enrolled,authenticatedPeer)){
   stream.abort(Error('Admission denied'));return;
  }
  try{
   const temporary=await issuer(authenticatedPeer);
   const encoded=new TextEncoder().encode(JSON.stringify(temporary));
   if(encoded.length>16000)throw Error('TURN provider returned oversized response');
   const framed=lpStream(stream);
   await framed.write(encoded,{signal:AbortSignal.timeout(8000)});
   await stream.close();
  }catch{
   stream.abort(Error('Credential unavailable'));
  }
 });
 return node;
}

async function main(){
 const rawKey=process.env.RELAY_PRIVATE_KEY_B64;
 const enrollment=process.env.ENROLLED_DEVICES_JSON;
 const token=process.env.TURN_KEY_API_TOKEN,keyId=process.env.TURN_KEY_ID;
 if(!rawKey||!enrollment||!token||!keyId)
  throw Error('Missing static identity, enrollment, or provider secrets');
 const privateKey=privateKeyFromProtobuf(Buffer.from(rawKey,'base64'));
 const enrolled=parseEnrolled(enrollment);
 const issuer=makeTurnIssuer({keyId,apiToken:token,allowed:id=>admit(enrolled,id)});
 const port=Number(process.env.PORT||10000);
 const node=await createPrivateRelay({
  privateKey,enrolled,issuer,port,host:'0.0.0.0',announceHost:process.env.PUBLIC_RELAY_HOST||null
 });
 for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>node.stop().finally(()=>process.exit(0)));
 // Do not print endpoint/private identifiers, message contents or provider tokens.
 console.log('Restricted relay service listening');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 main().catch(()=>{console.error('Restricted relay failed to start');process.exitCode=1;});
}
