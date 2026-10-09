import {randomBytes,scrypt as scryptCallback,createCipheriv,createDecipheriv,
  createHash,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {generateKeyPair,privateKeyFromProtobuf,privateKeyToProtobuf,publicKeyToProtobuf} from '@libp2p/crypto/keys';
const scrypt=promisify(scryptCallback);
const SCHEMA=2,CONTEXT=Buffer.from('PrivateSession|IdentityProfile|v1','utf8');
const ACCOUNT_ROLES=new Set(['host','protected']);
const KEY_LEN=32,PROFILE_MAX=9000,SCRYPT_OPTS={N:65536,r:8,p:1,maxmem:128*1024*1024};
const enc=b=>Buffer.from(b).toString('base64url');
function dec(value,max=PROFILE_MAX){
 if(typeof value!=='string'||value.length===0||value.length>max*2||!/^[A-Za-z0-9_-]+$/.test(value))
  throw Error('Invalid profile encoding');
 const b=Buffer.from(value,'base64url');
 if(b.length===0||b.length>max)throw Error('Invalid profile length');
 return b;
}
function checkPassword(password){
 if(typeof password!=='string'||Buffer.byteLength(password,'utf8')<16||Buffer.byteLength(password,'utf8')>512)
  throw Error('Passphrase needs at least 16 bytes');
}
function fingerprint(publicBytes){
 const digest=createHash('sha256').update(publicBytes).digest('hex');
 return digest.match(/.{1,4}/g).join('-').toUpperCase();
}
export async function newIdentity(){
 const key=await generateKeyPair('Ed25519');
 const priv=Buffer.from(privateKeyToProtobuf(key));
 const publicBytes=Buffer.from(publicKeyToProtobuf(key.publicKey));
 const fp=fingerprint(publicBytes);
 return {privateKeyBytes:priv,publicKeyBytes:publicBytes,fingerprint:fp};
}
export async function lockIdentity(privateKeyBytes,password,{accountRole}={}){
 if(!ACCOUNT_ROLES.has(accountRole))throw Error('Explicit Host or Protected account required');
 checkPassword(password);
 const source=Buffer.from(privateKeyBytes);
 if(source.length<16||source.length>PROFILE_MAX)throw Error('Invalid private identity');
 const original=privateKeyFromProtobuf(source);
 const publicBytes=Buffer.from(publicKeyToProtobuf(original.publicKey));
 const salt=randomBytes(16),iv=randomBytes(12);
 let key;
 try{
  key=await scrypt(password,salt,KEY_LEN,SCRYPT_OPTS);
  const cipher=createCipheriv('aes-256-gcm',key,iv,{authTagLength:16});
  const fp=fingerprint(publicBytes);
  const aad=Buffer.concat([CONTEXT,Buffer.from(fp,'utf8'),Buffer.from('|'+accountRole,'utf8')]);
  cipher.setAAD(aad);
  const ciphertext=Buffer.concat([cipher.update(source),cipher.final()]);
  return JSON.stringify({version:SCHEMA,accountRole,kdf:'scrypt-65536-8-1',enc:'aes-256-gcm',
   publicKey:enc(publicBytes),fingerprint:fp,salt:enc(salt),iv:enc(iv),
   data:enc(ciphertext),tag:enc(cipher.getAuthTag())});
 }finally{key?.fill(0);source.fill(0);publicBytes.fill(0);}
}
export async function unlockIdentity(serialized,password,{expectedAccountRole}={}){
 if(!ACCOUNT_ROLES.has(expectedAccountRole))throw Error('Explicit account role required');
 checkPassword(password);
 if(typeof serialized!=='string'||Buffer.byteLength(serialized,'utf8')>PROFILE_MAX*4)
  throw Error('Invalid encrypted profile');
 let obj;
 try{obj=JSON.parse(serialized);}catch{throw Error('Invalid encrypted profile');}
 if(!obj||obj.version!==SCHEMA||obj.accountRole!==expectedAccountRole||obj.kdf!=='scrypt-65536-8-1'||obj.enc!=='aes-256-gcm')
  throw Error('Unsupported identity profile version');
 const salt=dec(obj.salt,16),iv=dec(obj.iv,12),tag=dec(obj.tag,16);
 if(salt.length!==16||iv.length!==12||tag.length!==16)throw Error('Invalid profile parameters');
 const pub=dec(obj.publicKey,512),ciphertext=dec(obj.data);
 const fp=fingerprint(pub);
 if(typeof obj.fingerprint!=='string'||obj.fingerprint!==fp)throw Error('Public identity mismatch');
 let key,plaintext;
 try{
  key=await scrypt(password,salt,KEY_LEN,SCRYPT_OPTS);
  const cipher=createDecipheriv('aes-256-gcm',key,iv,{authTagLength:16});
  cipher.setAAD(Buffer.concat([CONTEXT,Buffer.from(fp,'utf8'),Buffer.from('|'+expectedAccountRole,'utf8')]));
  cipher.setAuthTag(tag);
  plaintext=Buffer.concat([cipher.update(ciphertext),cipher.final()]);
  const original=privateKeyFromProtobuf(plaintext);
  const expected=Buffer.from(publicKeyToProtobuf(original.publicKey));
  if(pub.length!==expected.length||!timingSafeEqual(pub,expected))throw Error('Profile public key mismatch');
  // Return a fresh application-owned buffer; caller must dispose it at End.
  return {privateKeyBytes:Buffer.from(plaintext),publicKeyBytes:Buffer.from(pub),fingerprint:fp,accountRole:expectedAccountRole};
 }catch{throw Error('Password incorrect or profile damaged');}
 finally{key?.fill(0);plaintext?.fill(0);}
}
