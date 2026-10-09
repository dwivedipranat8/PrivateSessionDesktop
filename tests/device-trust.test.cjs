'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {evaluateDeviceTrust}=require('../core/device-trust.cjs');
const full={platform:'win32',osSupported:true,securityUpdatesCurrent:true,
 releaseSignatureValid:true,verifiedBootEvidence:true,capturePolicyEnabled:true,noKnownTamper:true,
 knownCompromise:false};
test('missing or unknown evidence refuses before content',()=>{
 for(const field of ['osSupported','securityUpdatesCurrent','releaseSignatureValid','verifiedBootEvidence','capturePolicyEnabled','noKnownTamper']){
  assert.equal(evaluateDeviceTrust({...full,[field]:null}).allowed,false);
 }
 assert.equal(evaluateDeviceTrust(null).allowed,false);
});
test('known compromise refuses with neutral local and peer errors',()=>{
 const status=evaluateDeviceTrust({...full,knownCompromise:true});
 assert.equal(status.allowed,false);assert.equal(status.peerMessage,'Peer device security requirements not satisfied.');
});
test('macOS needs SIP, Gatekeeper and separate boot evidence',()=>{
 const mac={...full,platform:'darwin',sipEnabled:true,gatekeeperEnabled:true};
 assert.equal(evaluateDeviceTrust(mac).allowed,true);
 assert.equal(evaluateDeviceTrust({...mac,gatekeeperEnabled:false}).allowed,false);
 assert.equal(evaluateDeviceTrust({...mac,verifiedBootEvidence:null}).allowed,false);
});
test('no policy result is proof of no root-level attacker',()=>{
 assert.equal(evaluateDeviceTrust(full).proofOfNoRoot,false);
});
