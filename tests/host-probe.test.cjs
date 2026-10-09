'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {probeHostBasics,parseMacSIP,parseMacGatekeeper,parseWinSecureBoot}=require('../core/host-probe.cjs');
test('macOS assessment statuses are parsed strictly',()=>{
 assert.equal(parseMacSIP('System Integrity Protection status: enabled.'),true);
 assert.equal(parseMacSIP('System Integrity Protection status: disabled.'),false);
 assert.equal(parseMacGatekeeper('assessments enabled'),true);
 assert.equal(parseMacGatekeeper('assessments disabled'),false);
});
test('Windows secure boot unknown fails closed',()=>{
 assert.equal(parseWinSecureBoot('ENABLED'),true);
 assert.equal(parseWinSecureBoot('DISABLED'),false);
 assert.equal(parseWinSecureBoot('UNKNOWN'),false);
});
test('mac local probe is a hint, not a full kernel attestation',async()=>{
 const results={'csrutil':'System Integrity Protection status: enabled.',
  'spctl':'assessments enabled'};
 const got=await probeHostBasics({platform:'darwin',
  runCommand:async(cmd)=>({stdout:results[cmd]})});
 assert.equal(got.sipEnabled,true);assert.equal(got.gatekeeperEnabled,true);
 assert.equal(got.verifiedBootEvidence,null);assert.equal(got.proofOfNoRoot,false);
});
test('Windows probe returns unknown if command is unavailable',async()=>{
 const got=await probeHostBasics({platform:'win32',runCommand:async()=>{throw Error('No privileges');}});
 assert.equal(got.verifiedBootEvidence,null);
});
