'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ClearEndController}=require('../core/clear-end-controller.cjs');
function rig(sendAuthenticated=async()=>true){
 const events=[];
 const c=new ClearEndController({
  hide:()=>events.push('cover'),stopMedia:()=>events.push('stopAV'),
  clearChat:()=>events.push('deleteChat'),sendAuthenticated:async frame=>{events.push('encrypted:'+frame.kind);return sendAuthenticated(frame);},
  dispose:()=>events.push('destroyKeys'),makeRequestId:()=> 'unique_secure_clear_request_id_123',timeoutMs:30
 });
 return {c,events};
}
test('local screen and sensors clear before attempted encrypted peer notification',async()=>{
 const r=rig(),result=await r.c.localClear();
 assert.deepEqual(r.events,['cover','stopAV','deleteChat','encrypted:clear_end','destroyKeys']);
 assert.equal(result.localCleared,true);assert.equal(result.deliveryAttempted,true);
 assert.equal(result.remoteConfirmed,false);
});
test('remote Clear & End wipes only after cryptographically verified delivery',async()=>{
 const r=rig();
 assert.equal(await r.c.remoteClear('unique_secure_clear_request_id_123'),false);
 assert.deepEqual(r.events,[]);
 assert.equal(await r.c.remoteClear('unique_secure_clear_request_id_123',{fromAuthenticatedPinnedPeer:true}),true);
 assert.deepEqual(r.events,['cover','stopAV','deleteChat','encrypted:clear_ack','destroyKeys']);
});
test('network failure does not delay or undo local wipe',async()=>{
 const r=rig(async()=>{throw Error('network offline');});
 const result=await r.c.localClear();
 assert.equal(result.remoteConfirmed,false);
 assert.equal(result.deliveryAttempted,false);
 assert.deepEqual(r.events,['cover','stopAV','deleteChat','encrypted:clear_end','destroyKeys']);
});
test('a thrown cleanup callback cannot suppress other cleanup or key disposal',async()=>{
 const ev=[];
 const c=new ClearEndController({hide:()=>{ev.push('hide');throw Error('UI broken');},
  stopMedia:()=>ev.push('media'),clearChat:()=>ev.push('chat'),
  sendAuthenticated:async()=>true,dispose:()=>ev.push('keys'),makeRequestId:()=> 'unique_secure_clear_request_id_123'});
 await c.localClear();
 assert.deepEqual(ev,['hide','media','chat','keys']);
});
test('duplicate local Clear & End does not re-send or restore keys',async()=>{
 const r=rig();await r.c.localClear();await r.c.localClear();
 assert.equal(r.events.filter(x=>x==='encrypted:clear_end').length,1);
 assert.equal(r.events.filter(x=>x==='destroyKeys').length,1);
});
