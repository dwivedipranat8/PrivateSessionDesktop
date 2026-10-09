'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
test('lock/End always broadcasts cancellation even before session reaches active',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../app/main.cjs'),'utf8');
 const first=app.indexOf('function stop(reason)');
 const end=app.indexOf('function isAvailable',first);
 assert.ok(first>=0&&end>first);
 const body=app.slice(first,end);
 assert.match(body,/mediaDeadline=0;/);
 assert.match(body,/demo\.end\(reason\)/);
 assert.match(body,/webContents\.send\('p:stopped',status\)/);
 assert.equal(body.includes('if(demo.end(reason)'),false);
});
