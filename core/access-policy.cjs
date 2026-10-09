'use strict';
const ROLES=Object.freeze({BUILDER:'builder',PARTNER:'partner',PORTABLE:'portable'});
function allowed({purpose,left,right,approvedDeviceIds}){
 if(!left?.id||!right?.id||left.id===right.id||!approvedDeviceIds?.has(left.id)||!approvedDeviceIds.has(right.id))return false;
 const roles=[left.role,right.role].sort().join('|');
 return purpose==='private' ? roles==='partner|portable' : purpose==='test' && roles==='builder|partner';
}
function participantCanClearEnd({actor,hostDeviceId,protectedDeviceId,authenticated,purpose,approvedDeviceIds}){
 return purpose==='private'&&authenticated===true&&actor?.id!==undefined&&
  (actor.id===hostDeviceId||actor.id===protectedDeviceId)&&approvedDeviceIds?.has(actor.id)===true;
}
module.exports={ROLES,allowed,participantCanClearEnd};
