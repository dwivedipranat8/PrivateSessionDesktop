'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ROLES,allowed,hostCanDelete}=require('../core/access-policy.cjs');
const builder={id:'creator',role:ROLES.BUILDER},partner={id:'p1',role:ROLES.PARTNER},
 partner2={id:'p2',role:ROLES.PARTNER},portable={id:'mac1',role:ROLES.PORTABLE};
const approvedDeviceIds=new Set(['creator','p1','p2','mac1']);
test('partner multi-device allowed; builder has no private-chat access',()=>{
 assert.equal(allowed({purpose:'private',left:partner,right:portable,approvedDeviceIds}),true);
 assert.equal(allowed({purpose:'private',left:partner2,right:portable,approvedDeviceIds}),true);
 assert.equal(allowed({purpose:'private',left:builder,right:portable,approvedDeviceIds}),false);
 assert.equal(allowed({purpose:'test',left:builder,right:partner,approvedDeviceIds}),true);
 assert.equal(allowed({purpose:'test',left:builder,right:portable,approvedDeviceIds}),false);
});
test('host can delete only if authenticated',()=>{
 assert.equal(hostCanDelete({actor:partner,hostDeviceId:'p1',authenticated:true,purpose:'private'}),true);
 assert.equal(hostCanDelete({actor:portable,hostDeviceId:'p1',authenticated:true,purpose:'private'}),false);
 assert.equal(hostCanDelete({actor:partner,hostDeviceId:'p1',authenticated:false,purpose:'private'}),false);
});
