'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {evaluateRoleGuards,ROLE}=require('../core/role-requirements.cjs');
test('Host only needs trusted device and active network',()=>{
 assert.equal(evaluateRoleGuards(ROLE.HOST,{network:true,trust:true,accountLease:true}).allowed,true);
 assert.equal(evaluateRoleGuards(ROLE.HOST,{network:false,trust:true}).allowed,false);
});
test('Protected needs USB, camera, mic, network and capture policy verified',()=>{
 const healthy={network:true,trust:true,volume:true,camera:true,microphone:true,captureProtectionVerified:true,accountLease:true};
 assert.equal(evaluateRoleGuards(ROLE.PROTECTED,healthy).allowed,true);
 for(const f of Object.keys(healthy))
  assert.equal(evaluateRoleGuards(ROLE.PROTECTED,{...healthy,[f]:false}).allowed,false,f);
 assert.equal(evaluateRoleGuards('builder',healthy).allowed,false);
});

test('either role refuses chat if authenticated account renewal is not healthy',()=>{
 const healthy={network:true,trust:true,accountLease:false,camera:true,microphone:true,
  volume:true,captureProtectionVerified:true};
 assert.equal(evaluateRoleGuards(ROLE.HOST,healthy).allowed,false);
 assert.equal(evaluateRoleGuards(ROLE.PROTECTED,healthy).allowed,false);
});
