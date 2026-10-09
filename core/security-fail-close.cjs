'use strict';
/**
 * Before anything else, hide private data and stop sensors.
 * Notify the verified peer over EXISTING authenticated E2EE signalling only;
 * failure to notify must never keep the sensitive session running.
 */
const {REMOTE_MESSAGE,LOCAL_MESSAGE}=require('./device-trust.cjs');
class SecurityFailClose{
 constructor({hide,stopMedia,clearChat,sendAuthenticated,dispose,deadlineMs=250}={}){
  for(const fn of [hide,stopMedia,clearChat,sendAuthenticated,dispose])
   if(typeof fn!=='function')throw Error('Required fail-closed operation absent');
  this.hide=hide;this.stopMedia=stopMedia;this.clearChat=clearChat;
  this.sendAuthenticated=sendAuthenticated;this.dispose=dispose;
  this.deadlineMs=deadlineMs;this.closed=false;
 }
 async trigger(){
  if(this.closed)return {closed:true,notified:false,localMessage:LOCAL_MESSAGE};
  this.closed=true;
  for(const action of [this.hide,this.stopMedia,this.clearChat]){
   try{action();}catch{}
  }
  let notified=false,timer=null;
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(false),this.deadlineMs);});
  try{
   const attempted=Promise.resolve().then(()=>this.sendAuthenticated({kind:'security_fail'}))
      .then(()=>true,()=>false);
   notified=await Promise.race([attempted,timeout]);
  }catch{}
  finally{
   if(timer)clearTimeout(timer);
   try{this.dispose();}catch{}
  }
  return {closed:true,notified,localMessage:LOCAL_MESSAGE,
    peerMessage:REMOTE_MESSAGE};
 }
}
module.exports={SecurityFailClose};
