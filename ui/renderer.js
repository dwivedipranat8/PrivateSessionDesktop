'use strict';
const api=window.preview,e=id=>document.getElementById(id);
let active=false,starting=false,generation=0,attempt=0,stream=null,audioContext=null;
let analyser=null,analyserTimer=null,role='host';
const messageTimers=new Set();
const messages=new Set();
function clearMessages(text){
 for(const timer of messageTimers)clearTimeout(timer);messageTimers.clear();
 messages.clear();e('messages').replaceChildren();
 if(text){const p=document.createElement('p');p.className='empty';p.textContent=text;e('messages').append(p);}
}
function stopMedia(){
 if(analyserTimer){clearInterval(analyserTimer);analyserTimer=null;}
 analyser=null;
 if(audioContext){const old=audioContext;audioContext=null;old.close().catch(()=>{});}
 if(stream){for(const t of stream.getTracks()){t.onended=null;t.onmute=null;t.stop();}stream=null;}
 e('camera-view').pause();e('camera-view').srcObject=null;
 e('camera-view').style.display='none';e('no-camera').style.display='block';
 e('mic-level').style.width='0%';e('mic-state').textContent='OFF';
 e('sensor-status').textContent='Both required to start.';
}
function draw(){
 e('status').textContent=active?'Active':starting?'Preparing':'Inactive';
 e('status').className=active?'live':'';
 for(const id of ['end','fail','message-btn'])e(id).disabled=!active;
 e('start').disabled=active||starting;
 e('start').textContent=starting?'Checking devices…':'Start';
 for(const id of ['usb-btn','usb-clear','role'])e(id).disabled=active||starting;
 e('delete').hidden=role!=='host';
 e('delete').disabled=!active||role!=='host';
}
function stop(reason){
 active=false;starting=false;attempt+=1;generation+=1;
 clearMessages('Chat closed');stopMedia();draw();
 e('notice').textContent=reason||'Ended';
}
async function requestStop(reason,command){
 stop(reason);try{await command();}catch{}
}
function checkTracks(s){
 return s&&s.getVideoTracks().some(t=>t.readyState==='live'&&!t.muted)&&
    s.getAudioTracks().some(t=>t.readyState==='live'&&!t.muted);
}
function setupMicrophoneMeter(s){
 try{
  const AudioCtor=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtor)return;
  const ctx=new AudioCtor();audioContext=ctx;
  const source=ctx.createMediaStreamSource(new MediaStream(s.getAudioTracks()));
  const a=ctx.createAnalyser();a.fftSize=1024;source.connect(a);analyser=a;
  ctx.resume().catch(()=>{});
  const data=new Uint8Array(a.fftSize);
  analyserTimer=setInterval(()=>{
   if(!active||!stream||!checkTracks(stream)){if(active)requestStop('Camera or microphone unavailable',api.stop);return;}
   a.getByteTimeDomainData(data);let sum=0;
   for(const v of data){const d=(v-128)/128;sum+=d*d;}
   const rms=Math.sqrt(sum/data.length);
   e('mic-level').style.width=Math.min(100,Math.round(rms*380))+'%';
  },180);
 }catch{e('sensor-status').textContent='Mic on · activity meter unavailable';}
}
async function start(){
 if(active||starting)return;
 const mine=++attempt;starting=true;draw();e('notice').textContent='Allow camera and microphone';
 let candidate=null;
 try{
  const allowed=await api.armMedia();
  if(!allowed.ok)throw Error(allowed.error||'Cannot start');
  candidate=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
  if(mine!==attempt){candidate.getTracks().forEach(t=>t.stop());return;}
  if(!checkTracks(candidate))throw Error('Camera and microphone must both work');
  const begun=await api.start();
  if(mine!==attempt){candidate.getTracks().forEach(t=>t.stop());await api.stop();return;}
  if(!begun.ok)throw Error(begun.error||'Cannot start');
  stream=candidate;candidate=null;active=true;starting=false;generation=begun.generation;
  clearMessages('Add a test message');draw();
  e('camera-view').srcObject=stream;e('camera-view').style.display='block';
  e('no-camera').style.display='none';
  e('mic-state').textContent='ON';e('sensor-status').textContent='Camera + microphone active locally';
  e('notice').textContent='Local preview — no remote connection';
  for(const t of stream.getTracks()){
    t.onended=()=>{if(active)requestStop('Required device disconnected',api.stop);};
    t.onmute=()=>{if(active)requestStop('Required device unavailable',api.stop);};
  }
  setupMicrophoneMeter(stream);
 }catch(err){
  if(candidate)candidate.getTracks().forEach(t=>t.stop());
  if(mine===attempt){starting=false;draw();e('notice').textContent='Cannot start: '+(err?.message||'Check permissions');}
 }
}
function addMessage(){
 if(!active)return;
 if(e('messages').querySelector('.empty'))e('messages').replaceChildren();
 const ownerGeneration=generation;
 const policy=new window.MessagePolicy(performance.now());
 const item=document.createElement('div');item.className='bubble';
 const text=document.createElement('span');text.textContent='Test message';
 const foot=document.createElement('div');foot.className='bubble-foot';
 const seen=document.createElement('button');seen.className='seen';
 seen.textContent='Simulate Seen';
 const hint=document.createElement('small');hint.textContent='30s if unread';
 item.append(text);foot.append(seen,hint);item.append(foot);e('messages').append(item);
 messages.add(item);
 let timer=null;
 const remove=()=>{
   if(timer){clearTimeout(timer);messageTimers.delete(timer);timer=null;}
   messages.delete(item);item.remove();
 };
 const plan=()=>{
   if(timer){clearTimeout(timer);messageTimers.delete(timer);}
   const delay=Math.max(0,policy.expiresAt()-performance.now());
   timer=setTimeout(()=>{
     messageTimers.delete(timer);
     if(active&&generation===ownerGeneration)remove();
   },delay);
   messageTimers.add(timer);
 };
 seen.onclick=()=>{
   if(!active||generation!==ownerGeneration||!policy.markSeen(performance.now()))return;
   seen.remove();hint.textContent='Seen · disappears in 2s';plan();
 };
 plan();
}
async function deleteChat(){
 if(!active||role!=='host')return;
 const result=await api.deleteChat();
 if(result.ok&&active&&role==='host'){clearMessages('Chat deleted');e('notice').textContent='Demo chat cleared on this device';}
}
e('start').onclick=start;
e('end').onclick=()=>requestStop('Ended',api.stop);
e('fail').onclick=()=>requestStop('Simulated failure',api.fail);
e('message-btn').onclick=addMessage;
e('delete').onclick=deleteChat;
e('role').onchange=async()=>{
 const next=e('role').value;
 try{
  const r=await api.setRole(next);
  if(r.ok){role=r.role;clearMessages('Press Start to begin');draw();}
  else e('role').value=role;
 }catch{e('role').value=role;}
};
e('usb-btn').onclick=async()=>{const r=await api.folder();if(r.ok)e('usb-path').textContent=r.folder;e('notice').textContent=r.ok?'Folder selected':r.error;};
e('usb-clear').onclick=async()=>{const r=await api.clearFolder();if(r.ok)e('usb-path').textContent='No folder selected';};
api.onStop(s=>stop(s.reason));
api.status().then(s=>{
  active=Boolean(s.active);generation=s.generation;role=s.role==='guest'?'guest':'host';
  e('role').value=role;e('usb-path').textContent=s.folder||'No folder selected';draw();
}).catch(()=>e('notice').textContent='App not ready');
