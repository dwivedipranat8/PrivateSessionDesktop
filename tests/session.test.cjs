'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {DemoSession}=require('../core/session.cjs');
test('Start and End revoke old generation',()=>{
  const s=new DemoSession(),r=s.start();
  assert.equal(r.ok,true);assert.equal(s.current(r.generation),true);
  assert.equal(s.end('failed'),true);assert.equal(s.current(r.generation),false);assert.equal(s.end(),false);
});
test('No old session resumes',()=>{
  const s=new DemoSession(),old=s.start().generation;
  assert.equal(s.start().ok,false);s.end();s.start();assert.equal(s.current(old),false);
});
test('30s message lifetime is fixed',()=>{
  assert.equal(DemoSession.expiresAt(500,30),30500);
  assert.throws(()=>DemoSession.expiresAt(500,123));
});
