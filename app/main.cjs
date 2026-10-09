'use strict';
const {app,BrowserWindow,ipcMain,dialog,session,net,powerMonitor}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {DemoSession}=require('../core/session.cjs');
const demo=new DemoSession();let win=null,folder=null,allowedMedia=false,interval=null;
function stop(reason){
  allowedMedia=false;
  if(demo.end(reason)&&win&&!win.isDestroyed())win.webContents.send('p:stopped',demo.status());
  return demo.status();
}
function isAvailable(p){
  if(!p)return true;
  try{return fs.statSync(p).isDirectory()&&Array.isArray(fs.readdirSync(p));}catch{return false;}
}
function register(name,fn){
  ipcMain.handle('p:'+name,(event,...args)=>{
    if(!win||win.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Unapproved page');
    return fn(...args);
  });
}
app.whenReady().then(()=>{
  const volatileSession=session.fromPartition('local-dummy-preview');
  volatileSession.setPermissionRequestHandler((wc,permission,cb)=>{
    const yes=!!win&&wc.id===win.webContents.id&&demo.active&&allowedMedia&&permission==='media';
    allowedMedia=false;cb(Boolean(yes));
  });
  volatileSession.setPermissionCheckHandler((wc,permission)=>!!win&&wc?.id===win.webContents.id&&demo.active&&permission==='media');
  register('status',()=>({...demo.status(),folder}));
  register('start',()=>{
    if(folder&&!isAvailable(folder))return {ok:false,error:'Test USB folder unavailable'};
    if(!net.isOnline())return {ok:false,error:'Network interface reports offline'};
    return demo.start();
  });
  register('stop',()=>stop('Ended locally'));
  register('fail',()=>stop('Simulated failure'));
  register('folder',async()=>{
    if(demo.active)return {ok:false,error:'End demo before selecting a folder'};
    const chosen=await dialog.showOpenDialog(win,{title:'Select a folder on a spare USB (dummy test)',properties:['openDirectory']});
    if(chosen.canceled||!chosen.filePaths.length)return {ok:false,error:'Cancelled'};
    if(!isAvailable(chosen.filePaths[0]))return {ok:false,error:'Folder inaccessible'};
    folder=chosen.filePaths[0];return {ok:true,folder};
  });
  register('clear-folder',()=>{if(demo.active)return {ok:false};folder=null;return {ok:true};});
  register('sensor',kind=>{
    if(!demo.active||!['camera','microphone'].includes(kind))return {ok:false};
    allowedMedia=true;setTimeout(()=>{allowedMedia=false;},5000).unref?.();
    return {ok:true,generation:demo.generation};
  });
  win=new BrowserWindow({
    width:1020,height:690,minWidth:740,minHeight:520,show:false,
    title:'Private Session — Dummy Preview',backgroundColor:'#0d182a',
    webPreferences:{partition:'local-dummy-preview',preload:path.join(__dirname,'preload.cjs'),
      sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,devTools:false,backgroundThrottling:false}
  });
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.on('render-process-gone',()=>stop('App window stopped'));
  win.on('blur',()=>stop('Window lost focus'));
  win.on('minimize',()=>stop('Window minimized'));
  win.on('close',()=>stop('Window closed'));
  win.loadFile(path.join(__dirname,'../ui/index.html'));
  win.once('ready-to-show',()=>{if(win&&!win.isDestroyed())win.show();});
  powerMonitor.on('lock-screen',()=>stop('Device locked'));
  powerMonitor.on('suspend',()=>stop('Device sleeping'));
  interval=setInterval(()=>{
    if(!demo.active)return;
    if(folder&&!isAvailable(folder))stop('Test folder unavailable');
    else if(!net.isOnline())stop('Network interface reports offline');
  },750);
});
app.on('before-quit',()=>{stop('App quit');if(interval)clearInterval(interval);});
app.on('window-all-closed',()=>app.quit());
