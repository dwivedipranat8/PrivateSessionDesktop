'use strict';
export function makeTurnIssuer({keyId,apiToken,allowed,fetcher=fetch,now=()=>Date.now(),ttl=3900}){
 if(!keyId||!apiToken||typeof allowed!=='function'||typeof fetcher!=='function')
   throw Error('TURN secrets and authenticated admission required');
 if(ttl<3600||ttl>7200)throw Error('Credential expiry not compatible with session policy');
 const recent=new Map();
 return async function issue(peerId){
  if(!allowed(peerId))throw Error('Peer not enrolled');
  const t=now(),previous=recent.get(peerId);
  if(previous!==undefined&&t-previous<30000)throw Error('Credential request too frequent');
  recent.set(peerId,t);
  const endpoint='https://rtc.live.cloudflare.com/v1/turn/keys/'+encodeURIComponent(keyId)+'/credentials/generate-ice-servers';
  let response;
  try{
   response=await fetcher(endpoint,{
     method:'POST',headers:{Authorization:'Bearer '+apiToken,'Content-Type':'application/json'},
     body:JSON.stringify({ttl}),signal:AbortSignal.timeout(8000)
   });
  }catch{throw Error('TURN provider connection failed');}
  if(!response.ok)throw Error('TURN provider refused request');
  const payload=await response.json();
  if(!Array.isArray(payload.iceServers))throw Error('TURN provider returned invalid response');
  const list=[];
  for(const item of payload.iceServers){
   const input=Array.isArray(item.urls)?item.urls:[item.urls];
   const urls=input.filter(u=>typeof u==='string'&&/^turns?:/i.test(u));
   if(urls.length===0)continue;
   if(typeof item.username!=='string'||typeof item.credential!=='string')continue;
   list.push({urls,username:item.username,credential:item.credential});
  }
  if(list.length===0)throw Error('No acceptable TURN-only credentials supplied');
  return {iceServers:list,expiresInSeconds:ttl};
 };
}
