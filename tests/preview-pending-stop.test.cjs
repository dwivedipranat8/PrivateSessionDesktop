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

test('both preview roles may Clear & End but preview never claims remote deletion',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../app/main.cjs'),'utf8');
 assert.match(src,/register\('clear-end'/);
 assert.match(src,/Cleared & ended locally \(dummy preview only\)/);
 assert.equal(src.includes("register('delete-chat'"),false);
});

test('protected local preview requires selected USB folder and never claims encryption',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../app/main.cjs'),'utf8');
 assert.match(main,/role==='guest'&&!folder/);
 assert.match(main,/},500\);/);
 const html=fs.readFileSync(path.join(__dirname,'../ui/index.html'),'utf8');
 assert.match(html,/does not prove a genuine encrypted USB device/);
});
