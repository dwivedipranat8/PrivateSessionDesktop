import {readFile,open,stat,lstat} from 'node:fs/promises';
import path from 'node:path';
import {newIdentity,lockIdentity,unlockIdentity} from './identity.mjs';
const allowed=new Set(['host','protected']),MAX_SIZE=36000;
/**
 * Never commit real profiles or passphrases. Every profile contains only the
 * password-encrypted Ed25519 device identity; no chat, media, or log files.
 * This does not verify the path is removable or protect a compromised OS.
 */
function checkLocation(target){
 if(typeof target!=='string'||!path.isAbsolute(target)||
    path.basename(target)!=='PrivateSession.identity.enc.json')
  throw Error('Explicit absolute encrypted identity path required');
}
async function safeRead(target){
 checkLocation(target);
 const info=await lstat(target);
 if(!info.isFile()||info.isSymbolicLink()||info.size>MAX_SIZE)throw Error('Invalid encrypted identity file');
 return readFile(target,'utf8');
}
export async function createLocalProfile({target,role,passphrase}={}){
 checkLocation(target);
 if(!allowed.has(role))throw Error('Invalid account role');
 const directory=path.dirname(target),info=await stat(directory);
 if(!info.isDirectory())throw Error('Profile directory unavailable');
 let handle;
 // "wx" guarantees one-time create only and rejects symlink replacement.
 try{handle=await open(target,'wx',0o600);}
 catch{throw Error('Cannot create profile: destination exists or is unavailable');}
 let identity;
 try{
  identity=await newIdentity();
  const serialized=await lockIdentity(identity.privateKeyBytes,passphrase,{accountRole:role});
  await handle.writeFile(serialized,{encoding:'utf8'});
  await handle.sync();
  return {fingerprint:identity.fingerprint};
 }catch(error){
  // An empty/partial file must NOT be usable as a new authorized identity.
  // Do not auto overwrite a damaged profile without manual recovery review.
  throw error;
 }finally{
  identity?.privateKeyBytes.fill(0);
  await handle.close();
 }
}
export async function unlockLocalProfile({targets,passphrase}={}){
 if(!Array.isArray(targets)||!targets.length||targets.length>4)
  throw Error('Available encrypted identity locations required');
 let result=null;
 for(const target of targets){
  let raw;
  try{raw=await safeRead(target);}catch{continue;}
  let declared;
  try{declared=JSON.parse(raw).accountRole;}catch{continue;}
  if(!allowed.has(declared))continue;
  try{
   const identity=await unlockIdentity(raw,passphrase,{expectedAccountRole:declared});
   if(result){
    identity.privateKeyBytes.fill(0);
    result.identity.privateKeyBytes.fill(0);
    throw Error('Ambiguous profile credentials');
   }
   result={identity,role:declared,profilePath:target};
  }catch(error){
   if(error.message==='Ambiguous profile credentials')throw error;
  }
 }
 if(!result)throw Error('Incorrect password or required encrypted profile is missing');
 return result;
}
export function clearUnlockedProfile(result){
 try{result?.identity?.privateKeyBytes?.fill(0);}catch{}
}
