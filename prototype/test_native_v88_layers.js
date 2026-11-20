'use strict';
const fs=require('fs'), path=require('path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const cases=JSON.parse(fs.readFileSync(path.join(root,'tests/v88-native-trace-fixtures.json')));
const N=576*928, OFF=(x,y)=>(927-64-y)*576+x, FIRST=0x100000, SRC_BASE=0x300000, STEP=0x250000;
(async()=>{
 let checks=0;
 for(const c of cases.cases){
  const expectedMerman=c.layers.some(l=>l.source==='Merman:74');
  const expectedCape=c.layers.some(l=>l.source==='Cape:203');
  const start=Date.now();
  const memory=new WebAssembly.Memory({initial:420});
  const {instance}=await WebAssembly.instantiate(fs.readFileSync(path.join(__dirname,'native_underlay_v88.wasm')),{env:{memory}});
  const dv=new DataView(memory.buffer),set=(p,v)=>dv.setUint32(p,v>>>0,true);
  const gunPtr=SRC_BASE+c.layers.length*STEP;
  set(FIRST+12,c.layers.length+1);
  const slots=[];
  const getPixelArray=(ptr)=>new Uint8Array(memory.buffer,ptr+16,N*4);
  const fill=(ptr,raw)=>{
   set(ptr+12,N);const dst=getPixelArray(ptr);
   for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const frame=(y*64+x)*4,at=OFF(x,y)*4;
    dst.set(raw.subarray(frame,frame+4),at);
   }
  };
  for(const [i,l] of c.layers.entries()){
   const ptr=SRC_BASE+i*STEP;slots.push(ptr);set(FIRST+16+i*4,ptr);
   fill(ptr,Buffer.from(l.rgba,'base64'));
  }
  const gun=Buffer.from(cases.boltRGBA,'base64');
  set(FIRST+16+c.layers.length*4,gunPtr);fill(gunPtr,gun);
  const origGun=Buffer.from(getPixelArray(gunPtr));
  const originals=slots.map(s=>Buffer.from(getPixelArray(s)));
  const result=instance.exports.phm_native_underlay(FIRST,gunPtr,0);
  assert.deepEqual(Buffer.from(getPixelArray(gunPtr)),origGun,c.trace+': firearm unchanged');checks++;
  const modified=[];
  for(let i=0;i<slots.length;i++){
   const now=getPixelArray(slots[i]),original=originals[i];
   for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const p=OFF(x,y)*4;
    if(now[p]!==original[p]||now[p+1]!==original[p+1]||now[p+2]!==original[p+2]||now[p+3]!==original[p+3])modified.push([i,x,y]);
   }
  }
  if(expectedMerman){
    assert.ok(result>=8000,`${c.trace}: Merman new source match status ${result}`);checks++;
    const slot=c.layers.find(l=>l.source==='Merman:74').slot;
    const expectedSites=new Set(['27,19','26,20','27,20','27,21']);
    const repaired=modified.filter(([i,x,y])=>i===slot && expectedSites.has(x+','+y));
    assert.ok(repaired.length>=3,`${c.trace}: Merman pixels restored under gear. observed ${JSON.stringify(modified)}`);checks++;
    assert.ok(modified.every(([i,x,y])=>i===slot && expectedSites.has(x+','+y) || c.layers[i].source==='Cape:203' && x===27&&y===17),`${c.trace} modified only intended source layers: ${JSON.stringify(modified)}`);checks++;
  }else if(expectedCape){
    assert.ok(result>0,`${c.trace}: cape condition status ${result}`);checks++;
  }else{assert.ok(result<0,`${c.trace}: unidentified armor/back must safely skip, status ${result}`);checks++;}
  console.log('PASS',c.trace,'old',c.originalUnderlayStatus,'new',result,'source modifications',modified);

 }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
