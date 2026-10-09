'use strict';
const {randomBytes}=require('node:crypto');
class PeerLease{
  constructor({sessionId,clock=()=>performance.now(),random=()=>randomBytes(24).toString('base64url'),onProtect=()=>{},onExpire=()=>{}}){
    if(typeof sessionId!=='string'||sessionId.length<12)throw Error('Verified session identifier required');
    this.sessionId=sessionId;this.clock=clock;this.random=random;this.onProtect=onProtect;this.onExpire=onExpire;
    this.phase='awaiting-proof';this.createdAt=this.clock();this.outstanding=new Map();this.proof=null;
  }
  challenge(){
    // Check OLD proof deadline before issuing a newer nonce. Otherwise a
    // stalled event loop can revive a hidden/expired session.
    this.tick();
    if(this.phase==='protected'||this.phase==='expired')return null;
    const now=this.clock(),token=this.random();
    if(typeof token!=='string'||token.length<20||this.outstanding.has(token))throw Error('Fresh nonce required');
    this.outstanding.set(token,now);
    for(const [key,when] of this.outstanding)if(now-when>2000)this.outstanding.delete(key);
    return {kind:'challenge',sessionId:this.sessionId,token};
  }
  accept(response,{authenticated=false}={}){
    // Enforce previous deadline BEFORE adopting new evidence.
    this.tick();
    // Caller must verify the pinned peer using the authenticated encrypted channel.
    if(!authenticated||this.phase==='expired'||this.phase==='protected'||response?.kind!=='response'||
       response.sessionId!==this.sessionId)return false;
    const sentAt=this.outstanding.get(response.token);
    if(sentAt===undefined)return false;
    this.outstanding.delete(response.token);
    const delay=this.clock()-sentAt;
    if(delay<0||delay>2000||(this.proof!==null&&sentAt<=this.proof))return false;
    this.proof=sentAt;this.phase='active';this.tick();
    return this.phase==='active';
  }
  tick(){
    if(this.phase==='expired')return this.phase;
    // A peer that never provides its first proof cannot remain pending forever.
    if(this.proof===null&&this.clock()-this.createdAt>=5000){this.invalidate();return this.phase;}
    if(this.proof!==null&&this.clock()-this.proof>=5000){this.invalidate();return this.phase;}
    if(this.proof!==null&&this.clock()-this.proof>=3000&&this.phase!=='protected'){
      this.phase='protected';this.outstanding.clear();this.onProtect();
    }
    return this.phase;
  }
  invalidate(){
    if(this.phase==='expired')return;
    if(this.phase!=='protected')this.onProtect();
    this.phase='expired';this.outstanding.clear();this.onExpire();
  }
  get active(){this.tick();return this.phase==='active';}
}
module.exports={PeerLease};
