'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {evaluateSensitiveRelease}=require('../core/release-gate.cjs');
for(const platform of ['win32','darwin']){
 test('full fake green checklist still NEVER releases protected private app on '+platform,()=>{
  const everyFlag={osSupported:true,securityUpdatesCurrent:true,releaseSignatureValid:true,
   verifiedBootEvidence:true,capturePolicyEnabled:true,noKnownTamper:true,
   sipEnabled:true,gatekeeperEnabled:true,knownCompromise:false,
   macUsbHardwareTestPassed:true,independentSecurityReviewPassed:true,
   endToEndIntegrationPassed:true,signedReleaseValidated:true};
  const decision=evaluateSensitiveRelease({platform,reviewEvidence:everyFlag});
  assert.equal(decision.allowed,false);assert.equal(decision.mode,'NO_RELEASE');
  assert.ok(decision.blockers.includes('impossible_universal_capture_guarantee'));
 });
}
