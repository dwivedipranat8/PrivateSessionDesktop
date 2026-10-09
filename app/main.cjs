'use strict';
const {app,BrowserWindow,ipcMain,dialog,session,net,powerMonitor}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {DemoSession}=require('../core/session.cjs');
const demo=new DemoSession();
let win=null,folder=null,role='host',mediaDeadline=0,interval=null;
function stop(reason){
 mediaDeadline=0;
 if(demo.end(reason)&&win&&!win.isDestroyed())win.webContents.send('p:stopped',demo.status());
 return demo.status();
}
function isAvailable(p){
 if(!p)return true;
 try{return fs.statSync(p).isDirectory()&&Array.isArray(fs.readdirSync(p));}catch{return false;}
}
function guardReady(){
 if(folder&&!isAvailable(folder))return {ok:false,error:'Test USB folder unavailable'};
 if(!net.isOnline())return {ok:false,error:'Network reports offline'};
 return {ok:true};
}
function register(name,fn){
 ipcMain.handle('p:'+name,(event,...args)=>{
   if(!win||win.isDestroyed()||event.sender!==win.webContents||
       event.senderFrame!==win.webContents.mainFrame)throw Error('Unapproved page');
   return fn(...args);
 });
}
app.whenReady().then(()=>{
 const volatileSession=session.fromPartition('local-dummy-preview');
 const canUseMedia=wc=>!!win&&!win.isDestroyed()&&wc?.id===win.webContents.id &&
    (demo.active||Date.now()<mediaDeadline);
 volatileSession.setPermissionRequestHandler((wc,permission,callback)=>{
   callback(permission==='media'&&canUseMedia(wc));
 });
 volatileSession.setPermissionCheckHandler((wc,permission)=>
   permission==='media'&&canUseMedia(wc));
 register('status',()=>({...demo.status(),folder,role}));
 register('arm-media',()=>{
   if(demo.active)return {ok:false,error:'Session already active'};
   const check=guardReady();if(!check.ok)return check;
   mediaDeadline=Date.now()+20000;
   return {ok:true};
 });
 register('start',()=>{
   if(process.platform==='win32' && !win?.isContentProtected())return {ok:false,error:'Window capture exclusion unavailable'};
   if(demo.active)return {ok:false,error:'Session already active'};
   if(Date.now()>=mediaDeadline)return {ok:false,error:'Camera and microphone are required'};
   const check=guardReady();if(!check.ok){mediaDeadline=0;return check;}
   const r=demo.start();mediaDeadline=0;return r;
 });
 register('stop',()=>stop('Ended locally'));
 register('fail',()=>stop('Simulated failure'));
 register('set-role',next=>{
   if(demo.active||!['host','guest'].includes(next))return {ok:false};
   role=next;return {ok:true,role};
 });
 register('delete-chat',()=>{
   if(!demo.active||role!=='host')return {ok:false,error:'Only the host can clear the demo'};
   return {ok:true};
 });
 register('folder',async()=>{
   if(demo.active)return {ok:false,error:'End first'};
   const result=await dialog.showOpenDialog(win,{title:'Choose a test folder',properties:['openDirectory']});
   if(result.canceled||!result.filePaths.length)return {ok:false,error:'Cancelled'};
   if(!isAvailable(result.filePaths[0]))return {ok:false,error:'Folder unavailable'};
   folder=result.filePaths[0];return {ok:true,folder};
 });
 register('clear-folder',()=>{
   if(demo.active)return {ok:false,error:'End first'};
   folder=null;return {ok:true};
 });
 win=new BrowserWindow({
   width:1020,height:700,minWidth:740,minHeight:540,show:false,
   title:'Private Session — Local Preview',backgroundColor:'#0d182a',
   webPreferences:{partition:'local-dummy-preview',
     preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,
     nodeIntegration:false,webSecurity:true,devTools:false,backgroundThrottling:false}
 });
 // Electron applies Windows WDA_EXCLUDEFROMCAPTURE before first app content draw.
 // macOS NSWindowSharingNone does not block newer ScreenCaptureKit capture.
 try{win.setContentProtection(true);}catch{console.error('Window capture exclusion unavailable');}
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',e=>e.preventDefault());
 win.webContents.on('render-process-gone',()=>stop('App window stopped'));
 win.on('blur',()=>{if(demo.active)stop('Window lost focus');});
 win.on('minimize',()=>stop('Window minimized'));
 win.on('close',()=>stop('Window closed'));
 win.loadFile(path.join(__dirname,'../ui/index.html'));
 win.once('ready-to-show',()=>{if(win&&!win.isDestroyed())win.show();});
 powerMonitor.on('lock-screen',()=>stop('Device locked'));
 powerMonitor.on('suspend',()=>stop('Device sleeping'));
 interval=setInterval(()=>{
   if(!demo.active)return;
   const result=guardReady();
   if(!result.ok)stop(result.error);
 },750);
});
app.on('before-quit',()=>{stop('App quit');if(interval)clearInterval(interval);});
app.on('window-all-closed',()=>app.quit());
