'use strict';
/**
 * Seen means visible to the approved recipient's active UI, not guaranteed
 * cognitive reading. The UI must mark after actual paint and viewport check.
 */
function canAcknowledgeSeen({sessionActive,windowFocused,documentVisible,inViewport,covered,mediaHealthy}={}){
 return sessionActive===true&&windowFocused===true&&documentVisible===true&&
    inViewport===true&&covered===false&&mediaHealthy===true;
}
class SeenGate{
 constructor(){this.sent=new Set();}
 shouldSend(id,flags){
  if(typeof id!=='string'||id.length<12||this.sent.has(id)||!canAcknowledgeSeen(flags))return false;
  this.sent.add(id);return true;
 }
 clear(){this.sent.clear();}
}
module.exports={SeenGate,canAcknowledgeSeen};
