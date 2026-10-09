'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
test('two separately packaged Windows builds pin distinct account roles',()=>{
 const pkg=require('../package.json');
 const one=pkg.scripts['build:win:main'],two=pkg.scripts['build:win:protected'];
 assert.match(one,/extraMetadata\.privateSessionVariant=main/);
 assert.match(two,/extraMetadata\.privateSessionVariant=protected/);
 assert.match(one,/dist\/main/);assert.match(two,/dist\/protected/);
 assert.match(one,/PrivateSession-Main/);assert.match(two,/PrivateSession-Protected/);
});
test('main process checks installer identity independently of the renderer',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../app/main.cjs'),'utf8');
 assert.match(src,/function expectedAccountRole\(\)/);
 assert.match(src,/approvedSetupLocation\(location\)/);
 assert.match(src,/result\.role!==expectedAccountRole\(\)/);
 assert.match(src,/result\.identity|clearUnlockedProfile\(result\)/);
});
test('GitHub artifacts are separate and never named secure final',()=>{
 const flow=fs.readFileSync(path.join(__dirname,'../.github/workflows/build-preview.yml'),'utf8');
 assert.match(flow,/PrivateSession-Main-EXPERIMENTAL/);
 assert.match(flow,/PrivateSession-Protected-EXPERIMENTAL/);
 assert.match(flow,/path: dist\/main\/\*\.exe/);
 assert.match(flow,/path: dist\/protected\/\*\.exe/);
});
