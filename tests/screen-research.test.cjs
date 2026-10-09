'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
test('macOS capture candidates do not bypass absolute release blocker',()=>{
 const document=fs.readFileSync(path.join(__dirname,'../SCREEN_CAPTURE_RESEARCH.md'),'utf8');
 assert.match(document,/allowScreenShot=false/);
 assert.match(document,/Automatic Assessment Configuration/);
 const {evaluateSensitiveRelease}=require('../core/release-gate.cjs');
 assert.equal(evaluateSensitiveRelease({platform:'darwin'}).allowed,false);
});
