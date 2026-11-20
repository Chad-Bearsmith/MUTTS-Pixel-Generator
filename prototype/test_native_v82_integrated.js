'use strict';
/* Standalone native full-atlas 12-item test using user's exact Current/Fix
   image alignments, Unity's real Bolt 64x64 mask, and Unity's managed arrays.
   This does not constitute live game acceptance. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures_v82.json'),'utf8'));
const wasm=fs.readFileSync(path.join(__dirname,'native_underlay_v82.wasm'));
const b64=s=>new Uint8Array(Buffer.from(s,'base64'));
const bolt=b64(fixture.boltMask);
const LENGTH=576*928, IDLE=64, LIST=0x100000, LAYER=0x200000, GUN=0x500000;
const iat=(x,y)=>(927-(64+y))*576+x;
const fp=(x,y)=>(y*64+x)*4;
let passed=0;
function pass(label){++passed;console.log('PASS',label)}
(async()=>{
 const memory=new WebAssembly.Memory({initial:200});
 const {instance}=await WebAssembly.instantiate(wasm,{env:{memory}});
 const apply=instance.exports.phm_native_underlay;
 const view=new DataView(memory.buffer),set=(p,v)=>view.setUint32(p,v>>>0,true),get=p=>view.getUint32(p,true);
 function build(c){
  let current=b64(c.current),fix=b64(c.fix);
  new Uint8Array(memory.buffer,LAYER+16,LENGTH*4).fill(0);
  new Uint8Array(memory.buffer,GUN+16,LENGTH*4).fill(0);
  set(LIST+12,2);set(LIST+16,LAYER);set(LIST+20,GUN);
  set(LAYER+12,LENGTH);set(GUN+12,LENGTH);
  for(let y=0;y<IDLE;y++)for(let x=0;x<IDLE;x++){
    const at=iat(x,y),j=fp(x,y),alpha=bolt[j+3];
    const pix=alpha?bolt:current;
    set((alpha?GUN:LAYER)+16+at*4,(pix[j+3]<<24)|(pix[j+2]<<16)|(pix[j+1]<<8)|pix[j]);
  }
  function render(){
   let pixels=new Uint8Array(IDLE*IDLE*4);
   for(let y=0;y<IDLE;y++)for(let x=0;x<IDLE;x++){
    let at=iat(x,y),v=get(GUN+16+at*4);
    if(!(v>>>24))v=get(LAYER+16+at*4);
    let j=fp(x,y);pixels[j]=v&255;pixels[j+1]=(v>>>8)&255;pixels[j+2]=(v>>>16)&255;pixels[j+3]=(v>>>24)&255;
   }
   return pixels;
  }
  return {current,fix,render};
 }
 const gunBytes=()=>new Uint8Array(memory.buffer,GUN+16,LENGTH*4).slice();
 const layerBytes=()=>new Uint8Array(memory.buffer,LAYER+16,LENGTH*4).slice();
 for(const c of fixture.cases){
  const env=build(c),oldLower=layerBytes(),oldGun=gunBytes();
  const status=apply(LIST,GUN,0);
  assert.equal(status,c.item,c.name+' status');
  assert.deepEqual(gunBytes(),oldGun,c.name+' firearm unchanged');
  const out=env.render();
  for(let y=0;y<IDLE;y++)for(let x=0;x<IDLE;x++){
   const j=fp(x,y);
   if(bolt[j+3]==254)continue; // accepted hand marker colors/alpha remain native
   for(let channel=0;channel<4;channel++)
     assert.equal(out[j+channel],env.fix[j+channel],`${c.name} mismatch at (${x},${y}) channel ${channel}`);
  }
  const allow=new Set(c.changed.map(v=>iat(v.x,v.y)));
  const currentLower=layerBytes();
  for(let at=0;at<LENGTH;at++) if(!allow.has(at)) {
    const j=at*4;
    for(let k=0;k<4;k++)assert.equal(currentLower[j+k],oldLower[j+k],`${c.name} modified unrelated atlas at ${at}`);
  }
  pass(`${c.name} -> Fix (status ${c.item}; ${c.changed.length} pixels; other layers/frames/gun unchanged)`);
  // Rebuild from source and exercise strict whole-idle swatch/equipment mismatch.
  build(c);
  let old=layerBytes(),pos=iat(10,17);
  set(LAYER+16+pos*4,0xff123456);
  old=layerBytes();
  assert.equal(apply(LIST,GUN,0),-3,`${c.name}: unknown appearance should skip`);
  assert.deepEqual(layerBytes(),old,`${c.name}: failed fingerprint must not edit`);
  pass(`${c.name}: non-reference character safely skipped`);
  // Weapon alphas are checked across all 64x64; every changed pixel covered by
  // the firearm must be rejected, including unsupported rifle masks.
  build(c);pos=iat(c.changed[0].x,c.changed[0].y);
  set(GUN+16+pos*4,0xff000000);
  old=layerBytes();
  assert.equal(apply(LIST,GUN,0),-2,`${c.name}: firearm with changed mask should skip`);
  assert.deepEqual(layerBytes(),old,`${c.name}: gun mask mismatch must not edit`);
  pass(`${c.name}: firearm occlusion/mask failure safely skipped`);
 }
 build(fixture.cases[0]);set(LIST+20,0);let old=layerBytes();
 assert.equal(apply(LIST,GUN,0),-1);assert.deepEqual(layerBytes(),old);pass('invalid final firearm slot safely skipped');
 console.log(`ALL ${passed} native fixture checks passed`);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
