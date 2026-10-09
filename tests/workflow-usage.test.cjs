'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
test('PR runs must not double trigger as expensive branch pushes',()=>{
 const code=readFileSync(join(__dirname,'../.github/workflows/build-preview.yml'),'utf8');
 assert.match(code,/push:\s*\n    branches: \[main\]/);
 assert.doesNotMatch(code,/branches: \[main, development\/security-engine\]/);
});
test('Windows and Mac packaging require explicit manual opt-in from development',()=>{
 const code=readFileSync(join(__dirname,'../.github/workflows/build-preview.yml'),'utf8');
 assert.match(code,/github\.event_name == 'workflow_dispatch' && inputs\.verify_packages/);
 assert.match(code,/github\.event_name == 'workflow_dispatch' && inputs\.build_mac/);
 assert.match(code,/name: Windows-EXPERIMENTAL-NOT-SECURE/);
 assert.match(code,/name: Mac-EXPERIMENTAL-UNSIGNED/);
});
