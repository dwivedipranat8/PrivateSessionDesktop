'use strict';
const {evaluateDeviceTrust}=require('./device-trust.cjs');
const MANDATORY='all_recorders';
/**
 * Explicit production-release gate. We cannot currently prove a zero-capture
 * property on Windows/Mac; therefore the policy MUST prevent release, not
 * silently substitute an ordinary-OS-protection promise.
 *
 * This is a refusal, not a claim of solving screenshot protection.
 */
function evaluateSensitiveRelease({platform,reviewEvidence}={}){
 const base={...reviewEvidence,platform};
 const trust=evaluateDeviceTrust(base,{captureRequirement:MANDATORY});
 const blockers=new Set([...trust.failed]);
 if(!reviewEvidence?.macUsbHardwareTestPassed)blockers.add('physical_usb_test_missing');
 if(!reviewEvidence?.independentSecurityReviewPassed)blockers.add('security_review_missing');
 if(!reviewEvidence?.endToEndIntegrationPassed)blockers.add('integrated_app_missing');
 if(!reviewEvidence?.signedReleaseValidated)blockers.add('release_not_signed');
 return {allowed:blockers.size===0,mode:'NO_RELEASE',reason:'Absolute screenshot/recording prevention cannot currently be guaranteed on desktop operating systems.',blockers:[...blockers]};
}
module.exports={evaluateSensitiveRelease,MANDATORY};
