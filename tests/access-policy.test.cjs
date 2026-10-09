'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ROLES,allowed,participantCanClearEnd}=require('../core/access-policy.cjs');
const builder={id:'creator',role:ROLES.BUILDER},host={id:'p1',role:ROLES.PARTNER},
 protectedDevice={id:'mac1',role:ROLES.PORTABLE},other={id:'other',role:ROLES.PARTNER};
const approvedDeviceIds=new Set(['creator','p1','mac1']);
test('approved Host and Protected can communicate; builder cannot join',()=>{
 assert.equal(allowed({purpose:'private',left:host,right:protectedDevice,approvedDeviceIds}),true);
 assert.equal(allowed({purpose:'private',left:builder,right:protectedDevice,approvedDeviceIds}),false);
});
test('either participant can Clear & End only if approved and authenticated',()=>{
 const base={hostDeviceId:'p1',protectedDeviceId:'mac1',approvedDeviceIds,purpose:'private',authenticated:true};
 assert.equal(participantCanClearEnd({...base,actor:host}),true);
 assert.equal(participantCanClearEnd({...base,actor:protectedDevice}),true);
 assert.equal(participantCanClearEnd({...base,actor:builder}),false);
 assert.equal(participantCanClearEnd({...base,actor:other}),false);
 assert.equal(participantCanClearEnd({...base,actor:host,authenticated:false}),false);
});
