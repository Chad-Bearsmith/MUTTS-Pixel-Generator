'use strict';
/* Synthetic 25-source-mask × 12-item native WASM managed-array checks.
   Only Bolt's actual user-provided Current/Fix pair is a real target.
   Other guns are source alpha masks composited over the Bolt-reference
   character: verify safe underlay operation, not live character equivalence. */
const fs=require('node:fs'), path=require('node:path'),assert=require('node:assert/strict');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../firearms/fixtures-v84.json'),'utf8'));
const v82=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures_v82.json'),'utf8'));
const wasm=fs.readFileSync(path.join(__dirname,'native_underlay_v86.wasm'));
const b64=s=>new Uint8Array(Buffer.from(s,'base64'));
const LENGTH=576*928, LIST=0x100000,LAYER=0x200000, GUN=0x500000;
const pos=(x,y)=>(927-(64+y))*576+x;
const fp=(x,y)=>(y*64+x)*4;
const bolt=b64(v82.boltMask);
assert.equal(fixture.weapons.length,25);
assert.equal(new Set(fixture.weapons.map(w=>w.id)).size,24);
assert.equal(fixture.weapons.filter(w=>w.name==='Shotgun').length,2);
function colorAt(bytes,x,y){let k=fp(x,y);return bytes[k]|(bytes[k+1]<<8)|(bytes[k+2]<<16)|(bytes[k+3]<<24)}
let checks=0,applied=0,occluded=0;
(async()=>{
 const memory=new WebAssembly.Memory({initial:200});
 const {instance}=await WebAssembly.instantiate(wasm,{env:{memory}});
 const run=instance.exports.phm_native_underlay;
 const view=new DataView(memory.buffer);const set=(p,v)=>view.setUint32(p,v>>>0,true),get=p=>view.getUint32(p,true);
 const lbytes=()=>new Uint8Array(memory.buffer,LAYER+16,LENGTH*4);
 const gbytes=()=>new Uint8Array(memory.buffer,GUN+16,LENGTH*4);
 function setup(c,w){
   const raw=b64(c.current),gun=b64(w.rgba);
   lbytes().fill(0);gbytes().fill(0);
   set(LIST+12,2);set(LIST+16,LAYER);set(LIST+20,GUN);
   set(LAYER+12,LENGTH);set(GUN+12,LENGTH);
   for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      const px=pos(x,y),idx=fp(x,y);
      // Only original Bolt-transparent pixels contain known true character color.
      // Other locations are unknown in the user's supplied reference pairs.
      if(bolt[idx+3]===0)set(LAYER+16+px*4,colorAt(raw,x,y));
      set(GUN+16+px*4,colorAt(gun,x,y));
   }
   return {raw,gun};
 }
 for(const weapon of fixture.weapons){
   let recognized=0,hidden=0;
   for(const item of fixture.cases){
     const setupData=setup(item,weapon);
     const oldLower=lbytes().slice(),oldGun=gbytes().slice();
     const visible=item.patches.filter(p=>setupData.gun[fp(p.x,p.y)+3]===0);
     const result=run(LIST,GUN,0);
     if(weapon.id===0){assert.equal(result,item.id,`Bolt ${item.name}`)}
     else if(visible.length===0){assert.equal(result,-6,`${weapon.name} ${item.name}: fully hidden`);hidden++}
     else {assert.equal(result,weapon.id*100+item.id,`${weapon.name} ${item.name}`);recognized++}
     assert.deepEqual(gbytes(),oldGun,`${weapon.name} ${item.name}: original firearm unchanged`);
     const lower=lbytes();
     const changed=new Set(visible.map(p=>pos(p.x,p.y)));
     for(const p of visible){
       const expected=colorAt(b64(item.fix),p.x,p.y)>>>0;
       assert.equal(get(LAYER+16+pos(p.x,p.y)*4)>>>0,expected,`${weapon.name}/${item.name}: target (${p.x},${p.y})`);
     }
     // Every other 32-bit atlas pixel, including non-idle, must be unchanged.
     for(let at=0;at<LENGTH;at++)if(!changed.has(at)){
       const k=at*4;
       if(lower[k]!==oldLower[k]||lower[k+1]!==oldLower[k+1]||lower[k+2]!==oldLower[k+2]||lower[k+3]!==oldLower[k+3])
         throw Error(`${weapon.name}/${item.name}: non-target pixel changed at ${at}`);
     }
     checks++;
   }
   if(weapon.id!==0){applied+=recognized;occluded+=hidden}
   console.log(`PASS weapon ${weapon.name}: ${recognized} targeted cases, ${hidden} fully occluded cases`);
 }
 // Adversarial guard tests on AK-47 + Cape, where the correction site is clear
 // but the cape's original sample sits underneath the visible weapon.
 const cape=fixture.cases[0],ak=fixture.weapons.find(w=>w.name==='AK-47');
 assert(ak && ak.id>0);
 setup(cape,ak);let old=lbytes().slice();
 let basePos=pos(27,19);set(LAYER+16+basePos*4,0xff123456);
 old=lbytes().slice();assert.equal(run(LIST,GUN,0),5000+ak.id*100+cape.id,'weapon-covered recolor sample uses swatch fallback');checks++;
 setup(cape,ak);let altered=pos(27,17);set(LAYER+16+altered*4,0xff123456);
 old=lbytes().slice();assert.equal(run(LIST,GUN,0),-7,'changed target rejects');assert.deepEqual(lbytes(),old);checks++;
 setup(cape,ak);altered=pos(10,10);set(LAYER+16+altered*4,0xff123456);
 old=lbytes().slice();assert.equal(run(LIST,GUN,0),-3,'changed character fingerprint rejects');assert.deepEqual(lbytes(),old);checks++;
 setup(cape,ak);altered=pos(63,63);set(GUN+16+altered*4,0xff123456);
 old=lbytes().slice();assert.equal(run(LIST,GUN,0),-2,'unexpected firearm mask rejects');assert.deepEqual(lbytes(),old);checks++;
 setup(cape,ak);set(LIST+20,0);old=lbytes().slice();assert.equal(run(LIST,GUN,0),-1,'invalid pointer rejects');assert.deepEqual(lbytes(),old);checks++;
 console.log(`ALL ${checks} compiled-WASM cross-firearm tests passed (${applied} non-Bolt item/weapon combinations patched; ${occluded} correctly fully occluded)`);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
