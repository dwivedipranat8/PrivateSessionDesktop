'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('preview',Object.freeze({
 status:()=>ipcRenderer.invoke('p:status'),
 armMedia:()=>ipcRenderer.invoke('p:arm-media'),
 start:()=>ipcRenderer.invoke('p:start'),
 stop:()=>ipcRenderer.invoke('p:stop'),
 fail:()=>ipcRenderer.invoke('p:fail'),
 folder:()=>ipcRenderer.invoke('p:folder'),
 clearFolder:()=>ipcRenderer.invoke('p:clear-folder'),
 setRole:role=>ipcRenderer.invoke('p:set-role',role),
 deleteChat:()=>ipcRenderer.invoke('p:delete-chat'),
 onStop:fn=>{if(typeof fn==='function')ipcRenderer.on('p:stopped',(_e,data)=>fn(data));}
}));
