'use strict';
class ReadReceipts{
 constructor({sessionId,clock=()=>performance.now()}){
  if(!sessionId||sessionId.length<12)throw Error('Session identifier required');
  this.sessionId=sessionId;this.clock=clock;this.messages=new Map();
 }
 send(id,receiverDevice){
  if(!id||id.length<12||!receiverDevice||this.messages.has(id))return false;
  this.messages.set(id,{receiverDevice,created:this.clock(),seen:null});return true;
 }
 seen({sessionId,id,deviceId},{authenticated=false}={}){
  const entry=this.messages.get(id);
  if(!authenticated||sessionId!==this.sessionId||!entry||entry.receiverDevice!==deviceId||entry.seen!==null||
       this.clock()>=entry.created+20000)return false;
  entry.seen=this.clock();return true;
 }
 expiresAt(id){
  const e=this.messages.get(id);if(!e)return null;
  return Math.min(e.created+20000,e.seen===null?Infinity:e.seen+2000);
 }
 expire(){
  const out=[];
  for(const [id] of this.messages)if(this.clock()>=this.expiresAt(id)){out.push(id);this.messages.delete(id);}
  return out;
 }
 clear(){this.messages.clear();}
}
module.exports={ReadReceipts};
