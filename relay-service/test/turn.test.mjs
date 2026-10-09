import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeTurnIssuer} from '../src/turn.mjs';
test('Cloudflare TURN credentials issued only to enrolled peer, with no STUN-only fallback',async()=>{
 let request;
 const fetcher=async(url,options)=>{
  request={url,options};return {ok:true,json:async()=>({iceServers:[
   {urls:['stun:stun.cloudflare.com:3478']},
   {urls:['turn:turn.cloudflare.com:3478?transport=udp','turns:turn.cloudflare.com:5349?transport=tcp'],username:'short-lived',credential:'temporary'}
  ]})};
 };
 const issue=makeTurnIssuer({keyId:'id',apiToken:'secret',allowed:id=>id==='approved',
  fetcher,now:()=>1000});
 await assert.rejects(issue('unknown'));
 const result=await issue('approved');
 assert.equal(result.iceServers.length,1);
 assert.equal(result.iceServers[0].urls.every(u=>u.startsWith('turn')),true);
 assert.equal(JSON.parse(request.options.body).ttl,3900);
 assert.equal(request.options.headers.Authorization,'Bearer secret');
 await assert.rejects(issue('approved'));
});
test('no secret values in thrown provider errors',async()=>{
 const issue=makeTurnIssuer({keyId:'id',apiToken:'top-secret',allowed:()=>true,
  fetcher:async()=>({ok:false})});
 await assert.rejects(issue('approved'),e=>!String(e).includes('top-secret'));
});
