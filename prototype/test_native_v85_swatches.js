'use strict';
/* Synthetic swatch permutations and all known 25 firearm source-alpha masks.
   No claim that these permutations exactly implement Unity's swatch algorithm. */
const fs=require('node:fs'), path=require('node:path'),assert=require('node:assert/strict');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../firearms/fixtures-v84.json'),'utf8'));
const v82=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures_v82.json'),'utf8'));
const wasm=fs.readFileSync(path.join(__dirname,'native_underlay_v85.wasm'));
const b64=s=>new Uint8Array(Buffer.from(s,'base64'));
const LENGTH=576*928,LIST=0x100000,LAYER=0x200000,GUN=0x500000;
const pos=(x,y)=>(927-(64+y))*576+x;
const fp=(x,y)=>(y*64+x)*4;
const bolt=b64(v82.boltMask);
const rgbPermutations=[[0,1,2],[1,2,0],[2,0,1],[0,2,1],[2,1,0],[1,0,2]];
const recolor=(raw, perm)=>{
 const out=raw.slice();
 for(let i=0;i<out.length;i+=4){
  if(out[i+3]===0)continue;
  for(let c=0;c<3;c++)out[i+c]=raw[i+perm[c]];
 }
 return out;
};
const packed=(bytes,x,y)=>{const i=fp(x,y);return (bytes[i]|(bytes[i+1]<<8)|(bytes[i+2]<<16)|(bytes[i+3]<<24))>>>0};
(async()=>{
 const memory=new WebAssembly.Memory({initial:200});
 const {instance}=await WebAssembly.instantiate(wasm,{env:{memory}});
 const run=instance.exports.phm_native_underlay;
 const view=new DataView(memory.buffer),set=(p,v)=>view.setUint32(p,v>>>0,true),get=p=>view.getUint32(p,true);
 const lbytes=()=>new Uint8Array(memory.buffer,LAYER+16,LENGTH*4);
 const gbytes=()=>new Uint8Array(memory.buffer,GUN+16,LENGTH*4);
 function setup(c,w,perm){
   const raw=recolor(b64(c.current),perm),gun=b64(w.rgba);
   lbytes().fill(0);gbytes().fill(0);
   set(LIST+12,2);set(LIST+16,LAYER);set(LIST+20,GUN);
   set(LAYER+12,LENGTH);set(GUN+12,LENGTH);
   for(let y=0;y<64;y++)for(let x=0;x<64;x++){
     const idx=fp(x,y),pt=pos(x,y);
     if(bolt[idx+3]===0)set(LAYER+16+pt*4,packed(raw,x,y));
     set(GUN+16+pt*4,packed(gun,x,y));
   }
   return {raw,gun};
 }
 let checks=0, patches=0, occluded=0;
 for(const perm of rgbPermutations){
  for(const weapon of fixture.weapons){
   for(const item of fixture.cases){
    const {raw,gun}=setup(item,weapon,perm);
    const visible=item.patches.filter(p=>gun[fp(p.x,p.y)+3]===0);
    const originalGun=gbytes().slice();
    const beforePatch=new Map(item.patches.map(p=>[pos(p.x,p.y),get(LAYER+16+pos(p.x,p.y)*4)>>>0]));
    const ret=run(LIST,GUN,0);
    if(visible.length===0){assert.equal(ret,-6,`${item.name}/${weapon.name}: covered`);occluded++}
    else {
      assert.equal(ret,(perm[0]===0&&perm[1]===1&&perm[2]===2)?weapon.id*100+item.id:5000+weapon.id*100+item.id,`${item.name}/${weapon.name}: color permutation ${perm}`);
      patches++;
    }
    assert.deepEqual(gbytes(),originalGun,`${weapon.name}: weapon changed`);
    for(const p of item.patches){
      const pt=pos(p.x,p.y), actual=get(LAYER+16+pt*4)>>>0;
      const expected=gun[fp(p.x,p.y)+3]===0
         ? packed(recolor(b64(item.fix),perm),p.x,p.y)
         : beforePatch.get(pt);
      assert.equal(actual,expected,`${item.name}/${weapon.name} (${p.x},${p.y}) recolor ${perm}`);
    }
    checks++;
   }
  }
 }
 // Negative tests: altered alpha and color boundary should NOT write anywhere.
 const item=fixture.cases.find(c=>c.id===10),weapon=fixture.weapons.find(w=>w.name==='AK-47');
 setup(item,weapon,rgbPermutations[1]);
 const site=pos(10,10);
 set(LAYER+16+site*4,0xff123456);
 let before=lbytes().slice();
 assert.equal(run(LIST,GUN,0),-3);
 assert.deepEqual(lbytes(),before);checks++;
 setup(item,weapon,rgbPermutations[1]);
 const bad=pos(item.patches[0].x,item.patches[0].y);
 set(LAYER+16+bad*4,0xff123456);
 before=lbytes().slice();
 assert.equal(run(LIST,GUN,0),-7);
 assert.deepEqual(lbytes(),before);checks++;
 console.log(`PASS ${checks} WASM checks: ${patches} patch applications, ${occluded} occluded, 6 palette permutations, native weapon bytes unchanged`);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
