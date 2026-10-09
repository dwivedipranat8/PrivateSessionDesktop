'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {evaluateRoleGuards,ROLE}=require('../core/role-requirements.cjs');
test('Host only needs trusted device and active network',()=>{
 assert.equal(evaluateRoleGuards(ROLE.HOST,{network:true,trust:true}).allowed,true);
 assert.equal(evaluateRoleGuards(ROLE.HOST,{network:false,trust:true}).allowed,false);
});
test('Protected needs USB, camera, mic, network and capture policy verified',()=>{
 const healthy={network:true,trust:true,volume:true,camera:true,microphone:true,captureProtectionVerified:true};
 assert.equal(evaluateRoleGuards(ROLE.PROTECTED,healthy).allowed,true);
 for(const f of Object.keys(healthy))
  assert.equal(evaluateRoleGuards(ROLE.PROTECTED,{...healthy,[f]:false}).allowed,false,f);
 assert.equal(evaluateRoleGuards('builder',healthy).allowed,false);
});
