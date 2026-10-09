'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
test('capture exclusion is installed before the local Electron page loads',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../app/main.cjs'),'utf8');
 const protection=src.indexOf('win.setContentProtection(true)');
 const load=src.indexOf("win.loadFile(path.join(__dirname,'../ui/index.html'))");
 assert.ok(protection>=0&&load>protection);
});
test('development source never silently labels all Mac recorders blocked',()=>{
 const trust=fs.readFileSync(path.join(__dirname,'../core/device-trust.cjs'),'utf8');
 assert.match(trust,/macos_screencapturekit_bypass/);
});
