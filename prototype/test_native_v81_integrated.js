'use strict';
/* Tests the literal native helper body intended for injection. Uses Unity's
   actual managed array/list layout, original 576x928 bottom-up atlas, and
   original selected firearm alpha. Isolated fixtures, not live Unity. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=__dirname;
const fixture=JSON.parse(fs.readFileSync(path.join(root,'fixtures.json'),'utf8'));
const wasm=fs.readFileSync(path.join(root,'native_underlay_v81.wasm'));
const b64=s=>new Uint8Array(Buffer.from(s,'base64'));
const gunSrc=b64(fixture.occlusionMask);
const SIZE=576*928, list=0x100000, lower=0x200000, gun=0x500000;
const idx=(x,y)=>(927-(64+y))*576+x;
const point=(x,y)=>(y*64+x)*4;
let pass=0;
(async()=>{
 const memory=new WebAssembly.Memory({initial:200});
 const {instance}=await WebAssembly.instantiate(wasm,{env:{memory}});
 const apply=instance.exports.phm_native_underlay;
 const data=new DataView(memory.buffer), set=(p,v)=>data.setUint32(p,v>>>0,true),get=p=>data.getUint32(p,true);
 function build(c,special='bolt'){
  const curr=b64(c.current);
  const before=b64(c.current),fix=b64(c.fix);
  new Uint8Array(memory.buffer,lower+16,SIZE*4).fill(0);
  new Uint8Array(memory.buffer,gun+16,SIZE*4).fill(0);
  set(list+12,2);set(list+16,lower);set(list+20,gun);
  set(lower+12,SIZE);set(gun+12,SIZE);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
   let pos=point(x,y),i=idx(x,y),g=gunSrc[pos+3];
   // Gun pixel source has correct alpha mask; ignore unknown palette colors
   // in hand markers because fingerprint normalizes their RGB.
   if(g>0){const r=gunSrc[pos],gr=gunSrc[pos+1],b=gunSrc[pos+2];
    set(gun+16+i*4,(g<<24)|(b<<16)|(gr<<8)|r);
   }else {
    const r=curr[pos],gr=curr[pos+1],b=curr[pos+2],a=curr[pos+3];
    set(lower+16+i*4,(a<<24)|(b<<16)|(gr<<8)|r);
   }
  }
  if(special==='wrong-gun')set(gun+16+idx(29,19)*4,0xff123456);
  const copy=(x,y)=>get(lower+16+idx(x,y)*4), readOut=()=>{
    const out=new Uint8Array(64*64*4);
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      const i=idx(x,y), g=get(gun+16+i*4),l=get(lower+16+i*4),v=(g>>>24)?g:l;
      const p=point(x,y);
      out[p]=v&255;out[p+1]=(v>>>8)&255;out[p+2]=(v>>>16)&255;out[p+3]=v>>>24;
    }
    return out;
  };
  return {before,fix,readOut,copy};
 }
 for(const c of fixture.cases){
  const env=build(c),beforeLayer=new Uint8Array(memory.buffer,lower+16,SIZE*4).slice();
  const originalGun=new Uint8Array(memory.buffer,gun+16,SIZE*4).slice();
  const result=apply(list,gun,0);
  assert.equal(result,c.item,c.name+' status');
  const after=env.readOut();
  const markerPositions=[];for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(gunSrc[point(x,y)+3]==254)markerPositions.push(point(x,y));
  for(let p=0;p<after.length;p++) {
   if(markerPositions.some(o=>p>=o&&p<o+4))continue;
   assert.equal(after[p],env.fix[p],`${c.name}: mismatch at byte ${p}`);
  }
  assert.deepEqual(new Uint8Array(memory.buffer,gun+16,SIZE*4),originalGun,c.name+' weapon buffer immutable');
  // compare full original layer array, only explicit intended native coords allowed
  const allowed=new Set(c.changed.map(d=>idx(d.x,d.y)));
  const lowerAfter=new Uint8Array(memory.buffer,lower+16,SIZE*4);
  for(let i=0;i<SIZE;i++)if(!allowed.has(i)){
   assert.equal(get(lower+16+i*4),new DataView(beforeLayer.buffer).getUint32(i*4,true),`${c.name} non-target input mutation at ${i}`);
  }
  console.log('PASS',c.name,'native list stage, firearm unchanged, target fixed; status',result);pass++;
 }
 for(const c of fixture.cases){
  const env=build(c,'wrong-gun');
  const before=new Uint8Array(memory.buffer,lower+16,SIZE*4).slice();
  assert.equal(apply(list,gun,0),-2,c.name+' not-Bolt fail-closed');
  assert.deepEqual(new Uint8Array(memory.buffer,lower+16,SIZE*4),before);
  console.log('PASS',c.name,'non-Bolt source rejected');pass++;
 }
 console.log('PASS total',pass,'native integrated-underlay tests');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
