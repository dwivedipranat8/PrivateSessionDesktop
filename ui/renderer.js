'use strict';
const api=window.preview,e=id=>document.getElementById(id);
let active=false,starting=false,role=null,unlocked=false,attempt=0,generation=0,stream=null;
const messages=new Map();
let messageTimer=null;
function showGate(message=''){
 unlocked=false;active=false;starting=false;role=null;
 e('account-gate').hidden=false;e('app-shell').hidden=true;
 e('account-error').textContent=message;
 e('passphrase').value='';
}
function showApp(info){
 unlocked=true;role=info.role;
 e('account-gate').hidden=true;e('app-shell').hidden=false;
 e('drive-status').textContent=role==='guest'
   ?'External-drive profile location required for this preview; actual removable-drive verification is pending.'
   :'This device: encrypted local profile';
 e('media-indicator').textContent='Camera and microphone off';
 clearMessages('Start to test message expiry.');draw();
}
async function updateGate(){
 try{
  const state=await api.accountStatus();
  e('initial-setup').hidden=!!state.registered;
  e('account-form').hidden=false;
  e('unlock').hidden=!state.registered;
 }catch{e('account-error').textContent='Account service unavailable';}
}
async function unlock(){
 const password=e('passphrase').value;
 e('passphrase').value='';
 if(!password)return;
 try{
  const result=await api.accountUnlock(password);
  if(!result.ok)throw Error(result.error||'Could not unlock');
  showApp(result);
 }catch(err){e('account-error').textContent=err?.message||'Could not unlock';}
}
async function setup(location){
 const password=e('passphrase').value;
 e('passphrase').value='';
 if(password.length<16){e('account-error').textContent='Choose a password of at least 16 characters';return;}
 try{
  const result=await api.accountSetup(location,password);
  if(!result.ok)throw Error(result.error||'Cannot create encrypted profile');
  showApp(result);
 }catch(err){e('account-error').textContent=err?.message||'Profile setup failed';await updateGate();}
}
function clearMessages(label){
 messages.clear();
 e('messages').replaceChildren();
 if(label){const p=document.createElement('p');p.className='empty';p.textContent=label;e('messages').append(p);}
}
function stopMedia(){
 const owned=stream;stream=null;
 if(owned){for(const track of owned.getTracks()){try{track.onended=null;track.onmute=null;track.stop();}catch{}}}
 e('media-indicator').textContent='Camera and microphone off';
}
function draw(){
 e('status').textContent=active?'Active':starting?'Preparing':'Inactive';
 e('status').className=active?'live':'';
 for(const id of ['end','fail','message-btn','delete'])e(id).disabled=!active;
 e('start').disabled=!unlocked||active||starting;
 e('start').textContent=starting?'Checking permissions…':'Start local test';
 e('lock').disabled=active||starting;
}
function stop(reason){
 active=false;starting=false;attempt++;generation++;
 clearMessages('Session ended');stopMedia();draw();
 e('notice').textContent=reason||'Ended';
 showGate(reason||'Unlock again to continue');
 updateGate();
}
async function requestStop(reason,handler){
 if(!unlocked)return;
 stop(reason);
 try{await handler();}catch{}
}
function goodTracks(s){
 return s&&s.getVideoTracks().some(t=>t.readyState==='live'&&!t.muted)&&
 s.getAudioTracks().some(t=>t.readyState==='live'&&!t.muted);
}
async function start(){
 if(!unlocked||active||starting)return;
 const nonce=++attempt;starting=true;draw();
 e('notice').textContent='Preparing local test session';
 let acquired=null;
 try{
  const arm=await api.armMedia();
  if(!arm.ok)throw Error(arm.error||'Cannot start');
  if(role==='guest'){
   e('notice').textContent='Camera and microphone permission required';
   acquired=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
   if(nonce!==attempt){acquired.getTracks().forEach(t=>t.stop());return;}
   if(!goodTracks(acquired))throw Error('Both camera and microphone must be active');
  }
  const began=await api.start();
  if(nonce!==attempt){acquired?.getTracks().forEach(t=>t.stop());await api.stop();return;}
  if(!began.ok)throw Error(began.error||'Start refused');
  stream=acquired;acquired=null;active=true;starting=false;generation=began.generation;
  clearMessages('Add a dummy message');draw();
  if(stream){
   // Deliberately NO self-preview or microphone-level panel.
   // Keep a clear indicator that the camera and microphone are active.
   e('media-indicator').textContent='Camera and microphone active';
   for(const t of stream.getTracks()){
    t.onended=()=>{if(active)requestStop('Required media device removed',api.stop);};
    t.onmute=()=>{if(active)requestStop('Camera/microphone unavailable',api.stop);};
   }
  }
  e('notice').textContent='Local-only demo; no remote peer is connected';
 }catch(err){
  if(acquired)for(const t of acquired.getTracks()){try{t.stop();}catch{}}
  if(nonce===attempt){
   starting=false;draw();e('notice').textContent='Cannot start: '+(err?.message||'Permission failure');
  }
 }
}
function updateMessages(){
 if(!active)return;
 const now=performance.now();
 for(const [element,item] of messages){
  if(now>=item.policy.expiresAt()){
   messages.delete(element);element.remove();
   continue;
  }
  item.hint.textContent=(item.policy.seenAt===null?'Unseen':'Seen')+
    ' · deletes in '+Math.ceil((item.policy.expiresAt()-now)/1000)+'s (simulated)';
 }
}
function addMessage(){
 if(!active)return;
 if(e('messages').querySelector('.empty'))e('messages').replaceChildren();
 const policy=new window.MessagePolicy(performance.now());
 const element=document.createElement('div');element.className='bubble';
 const text=document.createElement('span');text.textContent='Dummy message — not sent to a remote device';
 const foot=document.createElement('div');foot.className='bubble-foot';
 const seen=document.createElement('button');seen.className='seen';
 seen.textContent='Simulate recipient Seen';
 const hint=document.createElement('small');
 foot.append(seen,hint);element.append(text,foot);e('messages').append(element);
 messages.set(element,{policy,hint});
 seen.onclick=()=>{
  if(!active||!messages.has(element)||!policy.markSeen(performance.now()))return;
  seen.remove();updateMessages();
 };
 updateMessages();
}
async function clearAndEnd(){
 if(!active)return;
 await requestStop('Chat cleared and ended locally (demo only)',api.clearEnd);
}
e('account-form').addEventListener('submit',event=>{event.preventDefault();unlock();});
e('setup-local').onclick=()=>setup('local');
e('setup-portable').onclick=()=>setup('portable');
e('start').onclick=start;
e('end').onclick=()=>requestStop('Session ended',api.stop);
e('fail').onclick=()=>requestStop('Simulated failure',api.fail);
e('message-btn').onclick=addMessage;
e('delete').onclick=clearAndEnd;
e('lock').onclick=()=>requestStop('Account locked',api.accountLock);
api.onStop(s=>stop(s.reason));
messageTimer=setInterval(updateMessages,250);
api.status().then(state=>{
 if(state.unlocked){showApp(state);}
 else{showGate('Enter your password');updateGate();}
}).catch(()=>showGate('Application could not load encrypted profiles'));
