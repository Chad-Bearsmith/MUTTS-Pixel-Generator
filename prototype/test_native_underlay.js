'use strict';
// Executes actual compiled native WASM underlay stage against exact user references.
// This does NOT run or patch the production Unity WebGL.wasm.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=__dirname;
const fixture=JSON.parse(fs.readFileSync(path.join(root,'fixtures.json'),'utf8'));
const originalWasm=fs.readFileSync(path.join(root,'corrective_underlay.wasm'));
assert(WebAssembly.validate(originalWasm));
const DIM=64*64*4, SRC=65536, GUN=SRC+DIM, OUT=GUN+DIM;
const toBytes=x=>new Uint8Array(Buffer.from(x,'base64'));
const pos=(x,y)=>(y*64+x)*4;
const colors={
  'Cape':[[234,50,60,255],[38,194,157,255]],
  'Fire Lizard':[[255,200,37,255],[82,183,228,255]],
  'Fire Lizard dark':[[237,118,20,255],[143,72,193,255]]
};
function recolor(array, palette){
 const out=array.slice();
 for(let i=0;i<out.length;i+=4)for(const [before,after] of palette){
  if(before.every((c,k)=>out[i+k]===c)){out.set(after,i);break;}
 }
 return out;
}
function mergePatchAssertion(before,after,expectedChanges){
 const diff=[];
 for(let p=0;p<DIM;p+=4)if(before[p]!==after[p]||before[p+1]!==after[p+1]||before[p+2]!==after[p+2]||before[p+3]!==after[p+3])diff.push([p/4%64,Math.floor(p/256)]);
 assert.equal(diff.length,expectedChanges.length);
 assert.deepEqual(diff.map(([x,y])=>`${x},${y}`).sort(),expectedChanges.map(v=>`${v.x},${v.y}`).sort());
}
(async()=>{
 const {instance}=await WebAssembly.instantiate(originalWasm);
 const {memory,apply_underlay}=instance.exports;
 let passed=0;
 function run(name,input,mask,item,weapon=49){
  assert.equal(input.length,DIM);assert.equal(mask.length,DIM);
  const heap=new Uint8Array(memory.buffer);heap.set(input,SRC);heap.set(mask,GUN);heap.fill(0x91,OUT,OUT+DIM);
  const changes=apply_underlay(SRC,GUN,OUT,item,weapon);
  return {changes,pixels:heap.slice(OUT,OUT+DIM)};
 }
 for(const entry of fixture.cases){
  const before=toBytes(entry.current),expected=toBytes(entry.fix),mask=toBytes(fixture.occlusionMask);
  const actual=run('exact',before,mask,entry.item);
  assert.equal(actual.changes,entry.changed.length);
  assert.deepEqual(actual.pixels,expected,`${entry.name}: byte-exact full 64x64 comparison`);
  mergePatchAssertion(before,actual.pixels,entry.changed);
  for(let i=0;i<DIM;i+=4)if(mask[i+3])assert.deepEqual(Array.from(actual.pixels.slice(i,i+4)),Array.from(before.slice(i,i+4)),`${entry.name}: firearm visible priority at ${(i/4)%64},${Math.floor(i/256)}`);
  console.log('PASS',entry.name,'byte-exact native overlay and firearm priority');passed++;

  // Alter every possible palette color in source and target, not the patch table.
  const palette=entry.name==='Cape'?[colors.Cape]:entry.name==='Fire Lizard'?[colors['Fire Lizard'],colors['Fire Lizard dark']]:[];
  const orig2=recolor(before,palette), expected2=recolor(expected,palette);
  const dynamic=run('swatch',orig2,mask,entry.item);
  assert.deepEqual(dynamic.pixels,expected2,`${entry.name}: palette-derived patch`);
  console.log('PASS',entry.name,'recolored palette simulation');passed++;

  // A firearm-covered target must retain the original visible pixel regardless of patch action.
  const blocked=mask.slice();const site=entry.changed[0];blocked[pos(site.x,site.y)+3]=255;
  const prevented=run('covered',before,blocked,entry.item);
  assert.deepEqual(Array.from(prevented.pixels.slice(pos(site.x,site.y),pos(site.x,site.y)+4)), Array.from(before.slice(pos(site.x,site.y),pos(site.x,site.y)+4)));
  console.log('PASS',entry.name,'firearm occlusion guard');passed++;

  for(const [weapon,name] of [[250,'AK-47 texture ID'],[0,'unknown weapon']]){
   const skip=run(name,before,mask,entry.item,weapon);
   assert.equal(skip.changes,0);assert.deepEqual(skip.pixels,before);
   console.log('PASS',entry.name,'fail closed:',name);passed++;
  }
  const skip=run('other item',before,mask,999);
  assert.equal(skip.changes,0);assert.deepEqual(skip.pixels,before);
  console.log('PASS',entry.name,'fail closed: other item');passed++;
 }
 // Source anchor missing must not be guessed, and must never create a new opaque pixel.
 const cape=fixture.cases[0],base=toBytes(cape.current),mask=toBytes(fixture.occlusionMask);
 const anchor=pos(27,18);base.fill(0,anchor,anchor+4);
 const missing=run('unavailable source anchor',base,mask,cape.item);
 assert.equal(missing.changes,0);assert.deepEqual(missing.pixels,base);
 console.log('PASS no source-color guessing');passed++;
 console.log('PASS total',passed,'native WASM prototype cases');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
