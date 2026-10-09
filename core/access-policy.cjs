'use strict';
const ROLES=Object.freeze({BUILDER:'builder',PARTNER:'partner',PORTABLE:'portable'});
function allowed({purpose,left,right,approvedDeviceIds}){
 if(!left?.id||!right?.id||left.id===right.id||!approvedDeviceIds?.has(left.id)||!approvedDeviceIds.has(right.id))return false;
 const roles=[left.role,right.role].sort().join('|');
 return purpose==='private' ? roles==='partner|portable' : purpose==='test' && roles==='builder|partner';
}
function hostCanDelete({actor,hostDeviceId,authenticated,purpose}){
 return purpose==='private'&&authenticated===true&&actor?.id===hostDeviceId;
}
module.exports={ROLES,allowed,hostCanDelete};
