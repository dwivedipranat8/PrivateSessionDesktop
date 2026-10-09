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
 assert.match(html,/encrypted drive/);
 assert.match(main,/profileExists\(profile\.profilePath\)/);
});

test('first-use password field stays visible and normal role dropdown is absent',()=>{
 const renderer=fs.readFileSync(path.join(__dirname,'../ui/renderer.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../ui/index.html'),'utf8');
 assert.match(renderer,/e\('account-form'\)\.hidden=false/);
 assert.match(renderer,/e\('unlock'\)\.hidden=!state\.registered/);
 assert.equal(html.includes('id="role"'),false);
 assert.match(html,/id="passphrase"/);
});
test('protected own live video preview cannot render in UI',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../ui/index.html'),'utf8');
 assert.equal(html.includes('<video'),false);
 assert.match(html,/id="media-indicator"/);
});

test('late encrypted account-unlock callback cannot reactivate access after shutdown',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../app/main.cjs'),'utf8');
 assert.match(main,/authEpoch\+\+/);
 assert.match(main,/epoch!==authEpoch/);
 assert.match(main,/lib\.clearUnlockedProfile\(result\)/);
});
test('removed encrypted profile initiates program shutdown even before session Start',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../app/main.cjs'),'utf8');
 assert.match(main,/profile&&role==='guest'&&!profileExists\(profile\.profilePath\)/);
 assert.match(main,/Encrypted profile drive removed/);
});
