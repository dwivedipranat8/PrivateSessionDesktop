'use strict';
class DemoSession {
  constructor(){this.active=false;this.generation=0;this.reason="Not started";}
  start(){if(this.active)return {ok:false,error:"Already active"};this.active=true;this.generation++;this.reason=null;return {ok:true,generation:this.generation};}
  end(why="Ended"){if(!this.active)return false;this.active=false;this.generation++;this.reason=String(why).slice(0,80);return true;}
  current(g){return this.active&&this.generation===g;}
  status(){return {active:this.active,generation:this.generation,reason:this.reason};}
  static expiresAt(start,ttl){if(![10,30,60,300].includes(ttl))throw Error("Bad lifetime");return start+ttl*1000;}
}
module.exports={DemoSession};
