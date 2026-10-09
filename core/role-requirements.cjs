'use strict';
const ROLE=Object.freeze({HOST:'host',PROTECTED:'protected'});
const REQUIREMENTS=Object.freeze({
 host:Object.freeze(['network','trust','accountLease']),
 protected:Object.freeze(['network','trust','volume','camera','microphone','captureProtectionVerified','accountLease'])
});
function evaluateRoleGuards(role,flags){
 if(!Object.values(ROLE).includes(role))return {allowed:false,failed:['invalid_role']};
 const failed=[];
 for(const f of REQUIREMENTS[role])if(flags?.[f]!==true)failed.push(f);
 return {allowed:failed.length===0,failed,role};
}
module.exports={ROLE,REQUIREMENTS,evaluateRoleGuards};
