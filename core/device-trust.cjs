'use strict';
// A strict *policy* for remotely unauthenticated LOCAL evidence.
// It does not provide trusted remote attestation, and a compromised kernel
// can forge these values. Unknown/missing evidence MUST NOT mean "clean".
const LOCAL_MESSAGE='Device security requirements not satisfied.';
const REMOTE_MESSAGE='Peer device security requirements not satisfied.';
function evaluateDeviceTrust(evidence,{captureRequirement='ordinary_os_capture'}={}){
 const failed=[];
 if(!evidence||typeof evidence!=='object')return {allowed:false,failed:['missing_evidence'],localMessage:LOCAL_MESSAGE,peerMessage:REMOTE_MESSAGE};
 const fields=['osSupported','securityUpdatesCurrent','releaseSignatureValid',
  'verifiedBootEvidence','capturePolicyEnabled','noKnownTamper'];
 for(const field of fields)if(evidence[field]!==true)failed.push(field);
 // The OS API's "protection enabled" bit is not a guarantee against all
 // recorders. On current macOS, ScreenCaptureKit can bypass Electron's flag.
 if(captureRequirement==='all_recorders')failed.push('impossible_universal_capture_guarantee');
 else if(captureRequirement!=='best_effort'&&captureRequirement!=='ordinary_os_capture')
   failed.push('unknown_capture_requirement');
 else if(captureRequirement==='ordinary_os_capture'&&evidence.platform==='darwin')
   failed.push('macos_screencapturekit_bypass');
 if(evidence.platform==='darwin'){
   if(evidence.sipEnabled!==true)failed.push('sipEnabled');
   if(evidence.gatekeeperEnabled!==true)failed.push('gatekeeperEnabled');
 }else if(evidence.platform!=='win32')failed.push('unsupported_platform');
 // Explicit detected tampering is always disqualifying; non-detection is not proof.
 if(evidence.knownCompromise===true)failed.push('known_compromise');
 return {allowed:failed.length===0,failed,localMessage:failed.length?LOCAL_MESSAGE:null,
   peerMessage:failed.length?REMOTE_MESSAGE:null,proofOfNoRoot:false};
}
module.exports={evaluateDeviceTrust,LOCAL_MESSAGE,REMOTE_MESSAGE};
