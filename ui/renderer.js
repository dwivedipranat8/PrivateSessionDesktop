'use strict';
const api=window.preview,e=id=>document.getElementById(id);
let active=false,generation=0,camera=null,microphone=null;const timers=new Set();
function clearMessages(text){
  for(const t of timers)clearTimeout(t);timers.clear();e('messages').replaceChildren();
  const p=document.createElement('p');p.className='empty';p.textContent=text;e('messages').append(p);
}
function stopMedia(){
  for(const s of [camera,microphone])if(s)s.getTracks().forEach(t=>t.stop());
  camera=null;microphone=null;e('camera-view').pause();e('camera-view').srcObject=null;
  e('camera-view').style.display='none';e('no-camera').style.display='block';
  e('camera-btn').textContent='Test camera';e('mic-btn').textContent='Test mic';
  e('sensor-status').textContent='No local sensor active.';
}
function redraw(){
  e('status').textContent=active?'Demo active':'Inactive';
  for(const id of ['end','fail','message-btn','camera-btn','mic-btn'])e(id).disabled=!active;
  for(const id of ['start','usb-btn','usb-clear'])e(id).disabled=active;
}
function stop(msg){
  active=false;generation++;clearMessages('Session ended. Old dummy messages will not return.');
  stopMedia();redraw();e('notice').textContent=msg||'Ended';
}
e('start').onclick=async()=>{
  try{
    const r=await api.start();if(!r.ok){e('notice').textContent=r.error;return;}
    active=true;generation=r.generation;clearMessages('Add a dummy test message.');
    redraw();e('notice').textContent='Local demo only — nobody is connected.';
  }catch(err){e('notice').textContent=err.message;}
};
e('end').onclick=()=>{stop('Ended locally');api.stop().catch(()=>{});};
e('fail').onclick=()=>{stop('Simulated failure');api.fail().catch(()=>{});};
e('message-btn').onclick=()=>{
  if(!active)return;
  if(e('messages').querySelector('.empty'))e('messages').replaceChildren();
  const d=document.createElement('div');d.className='bubble';d.textContent='TEST MESSAGE: NOT ENCRYPTED OR SENT';
  const small=document.createElement('small');small.textContent='Expires in 30 seconds';d.append(small);e('messages').append(d);
  const at=generation;
  const id=setTimeout(()=>{timers.delete(id);if(active&&generation===at)d.remove();},30000);timers.add(id);
};
async function sensor(kind){
  if(!active)return;const old=kind==='camera'?camera:microphone;
  if(old){
    old.getTracks().forEach(t=>t.stop());
    if(kind==='camera'){camera=null;e('camera-view').srcObject=null;e('camera-view').style.display='none';e('no-camera').style.display='block';e('camera-btn').textContent='Test camera';}
    else{microphone=null;e('mic-btn').textContent='Test mic';}
    e('sensor-status').textContent=kind+' stopped';return;
  }
  const at=generation;
  try{
    const p=await api.sensor(kind);if(!p.ok||!active||at!==generation)return;
    const s=await navigator.mediaDevices.getUserMedia(kind==='camera'?{video:true,audio:false}:{video:false,audio:true});
    if(!active||at!==generation){s.getTracks().forEach(t=>t.stop());return;}
    if(kind==='camera'){camera=s;e('camera-view').srcObject=s;e('camera-view').style.display='block';e('no-camera').style.display='none';e('camera-btn').textContent='Stop camera';}
    else{microphone=s;e('mic-btn').textContent='Stop mic';}
    e('sensor-status').textContent='Local '+kind+' active; not transmitted.';
  }catch(err){e('sensor-status').textContent='Sensor not available: '+err.name;}
}
e('camera-btn').onclick=()=>sensor('camera');e('mic-btn').onclick=()=>sensor('microphone');
e('usb-btn').onclick=async()=>{const r=await api.folder();e('notice').textContent=r.ok?'Test folder selected':r.error;if(r.ok)e('usb-path').textContent=r.folder;};
e('usb-clear').onclick=async()=>{const r=await api.clearFolder();if(r.ok)e('usb-path').textContent='None chosen';};
api.onStop(s=>stop(s.reason));
api.status().then(s=>{active=s.active;generation=s.generation;e('usb-path').textContent=s.folder||'None chosen';redraw();});
