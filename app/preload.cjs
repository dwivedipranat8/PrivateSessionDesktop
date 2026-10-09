'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('preview',Object.freeze({
 status:()=>ipcRenderer.invoke('p:status'),
 armMedia:()=>ipcRenderer.invoke('p:arm-media'),
 start:()=>ipcRenderer.invoke('p:start'),
 stop:()=>ipcRenderer.invoke('p:stop'),
 fail:()=>ipcRenderer.invoke('p:fail'),
 folder:()=>ipcRenderer.invoke('p:folder'),
 accountStatus:()=>ipcRenderer.invoke('p:account-status'),
 accountSetup:(location,passphrase)=>ipcRenderer.invoke('p:account-setup',location,passphrase),
 accountUnlock:passphrase=>ipcRenderer.invoke('p:account-unlock',passphrase),
 accountLock:()=>ipcRenderer.invoke('p:account-lock'),
 clearEnd:()=>ipcRenderer.invoke('p:clear-end'),
 onStop:fn=>{if(typeof fn==='function')ipcRenderer.on('p:stopped',(_e,data)=>fn(data));}
}));
