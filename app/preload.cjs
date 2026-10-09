'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('preview',Object.freeze({
 status:()=>ipcRenderer.invoke('p:status'),
 start:()=>ipcRenderer.invoke('p:start'),
 stop:()=>ipcRenderer.invoke('p:stop'),
 fail:()=>ipcRenderer.invoke('p:fail'),
 folder:()=>ipcRenderer.invoke('p:folder'),
 clearFolder:()=>ipcRenderer.invoke('p:clear-folder'),
 sensor:kind=>ipcRenderer.invoke('p:sensor',kind),
 onStop:fn=>{if(typeof fn==='function')ipcRenderer.on('p:stopped',(_e,data)=>fn(data));}
}));
