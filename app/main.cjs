'use strict';
const {app,BrowserWindow,ipcMain,dialog,session,net,powerMonitor}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {DemoSession}=require('../core/session.cjs');
const demo=new DemoSession();
let win=null,folder=null,role=null,profile=null,profileFileSignature=null,mediaDeadline=0,interval=null,lastUnlockAttempt=0,authEpoch=0;
let modulePromise=null;
function profileLibrary(){
 if(!modulePromise)modulePromise=import(pathToFileURL(path.join(__dirname,'../crypto-probe/src/local-profiles.mjs')).href);
 return modulePromise;
}
function hostProfilePath(){return path.join(app.getPath('userData'),'PrivateSession.identity.enc.json');}
function portableProfilePath(){
 // Portable Windows electron-builder unpacks process.execPath into a temp
 // directory. PORTABLE_EXECUTABLE_FILE is the original EXE on the actual drive.
 const launched=process.platform==='win32'?process.env.PORTABLE_EXECUTABLE_FILE:process.execPath;
 if(!launched)return null;
 const executable=path.resolve(launched);
 if(process.platform==='darwin'){
  const match=/^\/Volumes\/[^/]+\//.exec(executable);
  if(!match)return null; // Protected app MUST run from a mounted volume.
  return path.join(match[0],'PrivateSession.identity.enc.json');
 }
 // Portable Windows EXE: adjacent profile path. Removability is NOT verified.
 return path.join(path.dirname(executable),'PrivateSession.identity.enc.json');
}
function knownPaths(){
 const result=[hostProfilePath(),portableProfilePath()].filter(Boolean);
 return [...new Set(result)];
}
function profileExists(p){try{return fs.statSync(p).isFile();}catch{return false;}}
function accountSummary(){return {registered:knownPaths().some(profileExists),unlocked:!!profile};}
function fileSignature(file){
 try{
  const info=fs.statSync(file);
  if(!info.isFile())return null;
  return [info.dev,info.ino,info.size,info.mtimeMs].join(':');
 }catch{return null;}
}
function emergencyQuit(reason){
 // Main-process concealment does not depend on a possibly stalled renderer.
 if(win&&!win.isDestroyed())win.hide();
 stop(reason);
 app.exit(0);
}
function wipeProfile(){
 try{profile?.identity?.privateKeyBytes?.fill(0);}catch{}
 profile=null;role=null;folder=null;profileFileSignature=null;
}

function stop(reason){
 // Always invalidate pending permission/Start attempts, even when the demo
 // has not reached active state. A delayed renderer getUserMedia result must
 // be discarded and its tracks stopped after lock, sleep, USB loss or End.
 mediaDeadline=0;
 authEpoch++;
 demo.end(reason);
 wipeProfile();
 const status={...demo.status(),reason};
 if(win&&!win.isDestroyed())win.webContents.send('p:stopped',status);
 return status;
}
function isAvailable(p){
 if(!p)return true;
 try{return fs.statSync(p).isDirectory()&&Array.isArray(fs.readdirSync(p));}catch{return false;}
}
function guardReady(){
 // Demo-only folder simulation; neither volume identity nor encryption is
 // verified here. Real protected profile must be bound to enrolled USB.
 if(!profile)return {ok:false,error:'Unlock an encrypted local profile first'};
 if(role==='guest'&&!folder)return {ok:false,error:'Protected profile must be on an available volume'};
 if(role==='guest'&&(!profileExists(profile.profilePath)||
     !profileFileSignature||fileSignature(profile.profilePath)!==profileFileSignature))
  return {ok:false,error:'Encrypted device profile missing or changed'};
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
 const canUseMedia=wc=>!!profile&&role==='guest'&&!!win&&!win.isDestroyed()&&wc?.id===win.webContents.id &&
    (demo.active||Date.now()<mediaDeadline);
 volatileSession.setPermissionRequestHandler((wc,permission,callback)=>{
   callback(permission==='media'&&canUseMedia(wc));
 });
 volatileSession.setPermissionCheckHandler((wc,permission)=>
   permission==='media'&&canUseMedia(wc));
 register('status',()=>({...demo.status(),role,unlocked:!!profile,
    registered:knownPaths().some(profileExists)}));
 register('account-status',()=>accountSummary());
 register('account-setup',async(location,passphrase)=>{
   if(profile||demo.active||Date.now()<mediaDeadline||
      !['local','portable'].includes(location))return {ok:false,error:'Setup unavailable'};
   if(typeof passphrase!=='string'||Buffer.byteLength(passphrase,'utf8')<16)
    return {ok:false,error:'Use a passphrase of at least 16 characters'};
   const target=location==='local'?hostProfilePath():portableProfilePath();
   if(!target)return {ok:false,error:'Launch the protected app from the encrypted mounted drive'};
   if(profileExists(target))return {ok:false,error:'An encrypted profile already exists'};
   const epoch=authEpoch;
   try{
    const lib=await profileLibrary();
    if(epoch!==authEpoch)return {ok:false,error:'Setup cancelled'};
    if(location==='local')fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
    await lib.createLocalProfile({target,role:location==='local'?'host':'protected',passphrase});
    const result=await lib.unlockLocalProfile({targets:[target],passphrase});
    if(epoch!==authEpoch){lib.clearUnlockedProfile(result);return {ok:false,error:'Setup cancelled'};}
    profile=result;role=result.role==='protected'?'guest':'host';
    folder=result.role==='protected'?path.dirname(result.profilePath):null;
    profileFileSignature=result.role==='protected'?fileSignature(result.profilePath):null;
    return {ok:true,role,registered:true,unlocked:true};
   }catch{return {ok:false,error:'Profile setup failed; check drive and password, do not overwrite damaged profiles'};}
 });
 register('account-unlock',async(passphrase)=>{
   if(profile||demo.active)return {ok:false,error:'Already unlocked'};
   if(typeof passphrase!=='string')return {ok:false,error:'Password required'};
   const now=Date.now();
   if(now-lastUnlockAttempt<750)return {ok:false,error:'Wait before retrying'};
   lastUnlockAttempt=now;
   const epoch=authEpoch;
   try{
    const lib=await profileLibrary();
    const result=await lib.unlockLocalProfile({targets:knownPaths(),passphrase});
    if(epoch!==authEpoch){lib.clearUnlockedProfile(result);return {ok:false,error:'Unlock cancelled'};}
    profile=result;role=result.role==='protected'?'guest':'host';
    folder=result.role==='protected'?path.dirname(result.profilePath):null;
    profileFileSignature=result.role==='protected'?fileSignature(result.profilePath):null;
    if(result.role==='protected'&&!profileFileSignature){wipeProfile();return {ok:false,error:'Protected profile unavailable'};}
    return {ok:true,role,unlocked:true};
   }catch{return {ok:false,error:'Incorrect password or encrypted profile not available'};}
 });
 register('account-lock',()=>{stop('Account locked');return {ok:true};});
 register('arm-media',()=>{
   if(demo.active)return {ok:false,error:'Session already active'};
   const check=guardReady();if(!check.ok)return check;
   mediaDeadline=Date.now()+20000;
   return {ok:true};
 });
 register('start',()=>{
   if(role==='guest'&&process.platform==='win32' && !win?.isContentProtected())return {ok:false,error:'Window capture exclusion unavailable'};
   if(demo.active)return {ok:false,error:'Session already active'};
   if(role==='guest'&&Date.now()>=mediaDeadline)return {ok:false,error:'Protected view requires camera and microphone'};
   const check=guardReady();if(!check.ok){mediaDeadline=0;return check;}
   const r=demo.start();mediaDeadline=0;return r;
 });
 register('stop',()=>stop('Ended locally'));
 register('fail',()=>stop('Simulated failure'));
 register('clear-end',()=>{
   if(!demo.active)return {ok:false,error:'No active demo session'};
   // Both roles may Clear & End. This preview has no remote peer to notify.
   stop('Cleared & ended locally (dummy preview only)');
   return {ok:true};
 });
 register('folder',async()=>{
   if(demo.active||!profile||role!=='guest')return {ok:false,error:'USB profile location is fixed'};
   const result=await dialog.showOpenDialog(win,{title:'Choose a test folder',properties:['openDirectory']});
   if(result.canceled||!result.filePaths.length)return {ok:false,error:'Cancelled'};
   if(!isAvailable(result.filePaths[0]))return {ok:false,error:'Folder unavailable'};
   folder=result.filePaths[0];return {ok:true,folder};
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
 powerMonitor.on('lock-screen',()=>emergencyQuit('Device locked'));
 powerMonitor.on('suspend',()=>emergencyQuit('Device sleeping'));
 interval=setInterval(()=>{
   // Removal of the required encrypted profile ends access even before Start.
   if(profile&&role==='guest'&&(!profileFileSignature||
     fileSignature(profile.profilePath)!==profileFileSignature)){
    emergencyQuit('Encrypted profile drive removed or changed');return;
   }
   if(profile&&!net.isOnline()){
    emergencyQuit('Network unavailable');return;
   }
   if(!demo.active)return;
   const result=guardReady();
   if(!result.ok){
    if(/offline|removed|unavailable|changed/i.test(result.error))emergencyQuit(result.error);
    else stop(result.error);
   }
 },500);
});
app.on('before-quit',()=>{stop('App quit');if(interval)clearInterval(interval);});
app.on('window-all-closed',()=>app.quit());
