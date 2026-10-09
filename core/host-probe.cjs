'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);
const WIN_COMMAND=[
  '-NoProfile','-NonInteractive',
  '-Command','try { if (Confirm-SecureBootUEFI) { "ENABLED" } else { "DISABLED" } } catch { "UNKNOWN" }'
];
async function run(command,args,{runCommand=exec}={}){
 try{
  const r=await runCommand(command,args,{timeout:4000,windowsHide:true,maxBuffer:4096});
  return typeof r.stdout==='string'?r.stdout.trim():'';
 }catch{return '';}
}
function parseMacSIP(output){return /^System Integrity Protection status:\s*enabled\.\s*$/im.test(output);}
function parseMacGatekeeper(output){return /^assessments enabled\s*$/im.test(output);}
function parseWinSecureBoot(output){return output.trim()==='ENABLED';}
async function probeHostBasics({platform=process.platform,runCommand=exec}={}){
 if(platform==='darwin'){
  const [sip,gatekeeper]=await Promise.all([
   run('csrutil',['status'],{runCommand}),
   run('spctl',['--status'],{runCommand})
  ]);
  return {platform,sipEnabled:parseMacSIP(sip),
    gatekeeperEnabled:parseMacGatekeeper(gatekeeper),
    verifiedBootEvidence:null, // SIP alone is NOT Secure Boot attestation.
    scope:'local-os-policy-hints',proofOfNoRoot:false};
 }
 if(platform==='win32'){
  const response=await run('powershell.exe',WIN_COMMAND,{runCommand});
  return {platform,secureBootEnabled:parseWinSecureBoot(response),
   verifiedBootEvidence:parseWinSecureBoot(response) || null,
   scope:'local-os-policy-hints',proofOfNoRoot:false};
 }
 return {platform,scope:'unsupported',verifiedBootEvidence:null,proofOfNoRoot:false};
}
module.exports={probeHostBasics,parseMacSIP,parseMacGatekeeper,parseWinSecureBoot,WIN_COMMAND};
