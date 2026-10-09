'use strict';
const api=window.preview;
const e=id=>document.getElementById(id);
let unlocked=false,role=null,active=false,starting=false,sessionGeneration=0,nonce=0;
let stream=null,rtc=null,chatReady=false,peerPrepared=false,rtcStarted=false;
const pendingRtc=[],messages=new Map(),seenQueued=new Set();
function clearMessages(label=''){
 messages.clear();seenQueued.clear();e('messages').replaceChildren();
 if(label){const node=document.createElement('p');node.className='empty';node.textContent=label;e('messages').append(node);}
}
function stopMedia(){
 if(rtc){try{rtc.end('Session closed');}catch{}rtc=null;}
 const media=stream;stream=null;
 for(const track of media?.getTracks?.()||[]){
  try{track.onended=null;track.onmute=null;track.stop();}catch{}
 }
 e('media-indicator').textContent='Camera and microphone off';
 e('remote-video').srcObject=null;e('call-status').textContent='Call ended';
 rtcStarted=false;pendingRtc.length=0;
}
function draw(){
 e('status').textContent=chatReady?'Verified & encrypted':active?'Waiting for peer':'Inactive';
 e('status').className=chatReady?'live':'';
 e('start').disabled=!unlocked||active||starting;
 e('lock').disabled=active||starting;
 e('end').disabled=!active;
 e('delete').disabled=!active;
 e('prepare-peer').disabled=!active||peerPrepared;
 e('connect-peer').disabled=!peerPrepared;
 e('message-compose').disabled=!chatReady;
 e('send-peer').disabled=!chatReady;
}
function gate(reason=''){
 nonce++;unlocked=false;active=false;starting=false;peerPrepared=false;chatReady=false;
 clearMessages('No messages');stopMedia();draw();role=null;
 e('account-gate').hidden=false;e('app-shell').hidden=true;
 e('account-error').textContent=reason;
 e('passphrase').value='';
}
async function gateStatus(){
 const state=await api.accountStatus();
 e('account-form').hidden=false;e('unlock').hidden=!state.registered;
 e('initial-setup').hidden=!!state.registered;
}
async function openAccount(info){
 unlocked=true;role=info.role;active=false;peerPrepared=false;chatReady=false;
 e('account-gate').hidden=true;e('app-shell').hidden=false;
 e('host-capture-row').hidden=role!=='host';
 clearMessages('Unlock complete. Start and connect to the approved peer.');
 e('media-indicator').textContent='Camera and microphone off';
 draw();
 const id=await api.myPeerId();
 e('my-peer-id').textContent=id.ok?id.peerId:'Identity unavailable';
}
async function unlock(){
 const password=e('passphrase').value;
 e('passphrase').value='';
 const result=await api.accountUnlock(password);
 if(result.ok)await openAccount(result);
 else e('account-error').textContent=result.error||'Password incorrect';
}
async function setup(location){
 const password=e('passphrase').value;
 e('passphrase').value='';
 const result=await api.accountSetup(location,password);
 if(result.ok)await openAccount(result);
 else{e('account-error').textContent=result.error||'Setup refused';await gateStatus();}
}
function healthyMedia(s){
 return s?.getVideoTracks().some(x=>x.readyState==='live'&&!x.muted)&&
        s?.getAudioTracks().some(x=>x.readyState==='live'&&!x.muted);
}
async function start(){
 if(!unlocked||starting||active)return;
 const attempt=++nonce;starting=true;draw();
 let candidate=null;
 try{
  const arm=await api.armMedia();
  if(!arm.ok)throw Error(arm.error||'Authorization unavailable');
  if(role==='protected'||role==='guest'||(role==='host'&&e('host-share').checked)){
   candidate=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
   if(attempt!==nonce){candidate.getTracks().forEach(x=>x.stop());return;}
   if(!healthyMedia(candidate))throw Error('Camera and microphone unavailable');
  }
  const begun=await api.start();
  if(attempt!==nonce){candidate?.getTracks().forEach(x=>x.stop());await api.stop();return;}
  if(!begun.ok)throw Error(begun.error||'Start blocked');
  active=true;starting=false;sessionGeneration=begun.generation;stream=candidate;candidate=null;
  if(stream){
   e('media-indicator').textContent='Camera and microphone active';
   for(const track of stream.getTracks()){
    track.onended=()=>terminate('Media device disconnected',api.stop);
    track.onmute=()=>terminate('Media device unavailable',api.stop);
   }
  }
  e('notice').textContent='Enter pinned relay and peer details in Connection setup';
  draw();
 }catch(err){
  for(const t of candidate?.getTracks?.()||[])t.stop();
  if(attempt===nonce){starting=false;draw();e('notice').textContent=err?.message||'Start failed';}
 }
}
async function terminate(message,fn=api.stop){
 if(!unlocked)return;
 gate(message);
 try{await fn();}catch{}
 await gateStatus().catch(()=>{});
}
function renderBubble(id,text,{outgoing=false}={}){
 if(!active||messages.has(id))return;
 if(e('messages').querySelector('.empty'))e('messages').replaceChildren();
 const bubble=document.createElement('article');
 bubble.className='bubble'+(outgoing?' outgoing':'');
 bubble.dataset.messageId=id;
 const content=document.createElement('span');content.textContent=text;
 const foot=document.createElement('div');foot.className='bubble-foot';
 bubble.append(content,foot);e('messages').append(bubble);
 messages.set(id,{bubble,foot,policy:new window.MessagePolicy(performance.now()),outgoing});
 e('messages').scrollTop=e('messages').scrollHeight;
 if(!outgoing)void reportSeenIfVisible(id);
}
async function reportSeenIfVisible(id){
 if(!chatReady||!messages.has(id)||seenQueued.has(id)||
   document.visibilityState!=='visible'||!document.hasFocus())return;
 const entry=messages.get(id);
 if(entry.outgoing||entry.policy.seenAt!==null)return;
 seenQueued.add(id);
 const proof=await api.peerSeen(id);
 if(!messages.has(id))return;
 if(proof.ok)entry.policy.markSeen(performance.now());
 else seenQueued.delete(id);
}
function updateMessages(){
 if(!active)return;
 for(const [id,entry] of messages){
  const policy=entry.policy;
  if(performance.now()>=policy.expiresAt()){
   entry.bubble.remove();messages.delete(id);continue;
  }
  entry.foot.textContent=(policy.seenAt===null?'Unseen':'Seen')+
   ' · erase in '+Math.ceil((policy.expiresAt()-performance.now())/1000)+'s';
 }
}
async function sendText(){
 if(!chatReady)return;
 const text=e('message-compose').value.trim();
 if(!text||text.length>2048)return;
 e('message-compose').value='';
 const result=await api.peerSend(text);
 if(result.ok)renderBubble(result.id,text,{outgoing:true});
 else e('notice').textContent=result.error||'Delivery not confirmed';
}
async function peerPrepare(){
 if(!active||peerPrepared)return;
 const config={relayAddress:e('relay-address').value.trim(),
  relayPeerId:e('relay-peer').value.trim(),peerId:e('peer-id').value.trim(),
  sessionId:e('session-id').value.trim()};
 e('prepare-peer').disabled=true;e('notice').textContent='Authenticating pinned relay and account…';
 try{
  const result=await api.peerPrepare(config);
  if(!result.ok)throw Error(result.error||'Connection refused');
  peerPrepared=true;
  e('own-circuit').value=result.addresses?.[0]||'No relay reservation yet; verify server configuration';
  e('notice').textContent='Share verified relay address with the approved peer';
 }catch(err){e('notice').textContent=err?.message||'Relay setup failed';}
 draw();
}
async function peerConnect(){
 if(!peerPrepared)return;
 const result=await api.peerConnect(e('remote-circuit').value.trim());
 e('notice').textContent=result.ok?'Waiting for authenticated heartbeat proof…':'Peer connection refused';
}
function handlePeerEvent(event){
 if(!unlocked||!active||!event||typeof event!=='object')return;
 if(event.type==='peer-connected'){e('notice').textContent='Peer transport established; proving liveness…';}
 if(event.type==='ready'){
  chatReady=true;draw();
  e('notice').textContent='Authenticated encrypted connection (experimental)';
  void setupRtc();
 }
 if(event.type==='incoming')renderBubble(event.id,event.text);
 if(event.type==='seen'){
  const item=messages.get(event.id);
  if(item?.outgoing)item.policy.markSeen(performance.now());
 }
 if(event.type==='expired'){
  const item=messages.get(event.id);item?.bubble.remove();messages.delete(event.id);
 }
 if(event.type==='rtc-signal')void acceptRtcSignal(event.frame);
 if(event.type==='conceal'){clearMessages('Session verification delayed');chatReady=false;draw();}
 if(event.type==='cleared'){clearMessages('Session cleared');chatReady=false;draw();}
 if(event.type==='closed')void terminate('Authenticated session ended',api.stop);
}
async function setupRtc(){
 if(!chatReady||rtcStarted||!window.RTCCall)return;
 rtcStarted=true;
 try{
  const cfg=await api.peerTurn();
  if(!cfg.ok)throw Error('Authenticated media relay unavailable');
  rtc=new window.RTCCall({
   sessionId:e('session-id').value.trim(),localDeviceId:e('my-peer-id').textContent,
   peerDeviceId:e('peer-id').value.trim(),role:role==='guest'?'protected':'host',
   sendAuthenticated:async frame=>(await api.peerRtc(frame)).ok===true,
   onRemoteMedia:streams=>{
    e('remote-video').srcObject=streams?.[0]||null;
    if(streams?.[0])e('remote-video').play().catch(()=>{});
   },onStop:()=>{e('call-status').textContent='Encrypted video call ended';}
  });
  await rtc.prepare({localStream:stream,iceServers:cfg.iceServers,initiator:role==='host'});
  e('call-status').textContent='Call negotiation in progress (TURN-only, DTLS-SRTP)';
  for(const frame of pendingRtc.splice(0))await rtc.acceptSignal(frame,{fromAuthenticatedPinnedNoisePeer:true});
 }catch(err){
  e('call-status').textContent=err?.message||'Encrypted media unavailable';
  rtc?.end('Setup failed');rtc=null;
 }
}
async function acceptRtcSignal(frame){
 if(!rtc){if(pendingRtc.length<32)pendingRtc.push(frame);else await terminate('Media signalling overflow');return;}
 const success=await rtc.acceptSignal(frame,{fromAuthenticatedPinnedNoisePeer:true});
 if(!success)await terminate('Authenticated call signalling rejected');
}
async function clearAndEnd(){
 if(!active)return;
 // The renderer clears displayed sensitive content synchronously.
 clearMessages('Conversation cleared');stopMedia();chatReady=false;draw();
 await terminate('Cleared & ended',api.peerClear);
}
e('account-form').addEventListener('submit',event=>{event.preventDefault();void unlock();});
e('setup-local').onclick=()=>void setup('local');
e('setup-portable').onclick=()=>void setup('portable');
e('start').onclick=()=>void start();
e('lock').onclick=()=>void terminate('Account locked',api.accountLock);
e('end').onclick=()=>void terminate('Session ended',api.stop);
e('delete').onclick=()=>void clearAndEnd();
e('generate-session').onclick=()=>e('session-id').value=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
e('prepare-peer').onclick=()=>void peerPrepare();
e('connect-peer').onclick=()=>void peerConnect();
e('send-peer').onclick=()=>void sendText();
e('message-compose').onkeydown=event=>{if(event.key==='Enter')void sendText();};
window.addEventListener('focus',()=>{for(const id of messages.keys())void reportSeenIfVisible(id);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')for(const id of messages.keys())void reportSeenIfVisible(id);});
api.onStop(status=>{gate(status.reason||'Session stopped');void gateStatus();});
api.onPeerEvent(handlePeerEvent);
setInterval(updateMessages,250);
api.status().then(async status=>{
 if(status.unlocked)await openAccount(status);
 else{gate('Enter your password');await gateStatus();}
}).catch(()=>gate('Encrypted profile service unavailable'));
