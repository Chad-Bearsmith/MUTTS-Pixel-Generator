'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'firearms/fixtures-v84.json')));
const gun=Buffer.from(fixtures.weapons.find(w=>w.name==='Bolt').rgba,'base64');
const LEN=576*928,LIST=0x100000,LAYER=0x200000,GUN=0x500000;
const idx=(x,y)=>(927-(64+y))*576+x, off=(x,y)=>(y*64+x)*4;
const cases=[
 {i:0,id:2,name:'Fire Lizard, palette 12',patch:[[27,18,25,20],[26,19,25,20],[27,19,29,19],[26,20,29,19],[27,20,29,19]]},
 {i:1,id:8,name:'Lizard, palette 12',patch:[[27,18,25,20],[26,19,25,20],[27,19,29,19],[26,20,29,19],[27,20,29,19]]},
 {i:2,id:10,name:'Werewolf, palette 4',patch:[[26,18,28,19],[27,18,28,19],[26,19,25,19],[27,19,25,19],[26,20,28,19],[27,20,28,19]]},
 {i:3,id:10,name:'Werewolf, palette 19',patch:[[26,18,28,19],[27,18,28,19],[26,19,25,19],[27,19,25,19],[26,20,28,19],[27,20,28,19]]}
];
(async()=>{
 let checks=0;
 for(const t of cases){
  const data=fs.readFileSync(path.join(root,'real-v86-examples',`frame-${t.i}.npy`));
  const hdr=Buffer.from(data.subarray(0,180)).toString('latin1');
  const start=hdr.indexOf('\n')+1;
  assert.ok(start>0 && hdr.includes('(64, 64, 4)'));
  const frame=new Uint8Array(data.subarray(start,start+64*64*4));assert.equal(frame.length,64*64*4);
  const targets=new Map(t.patch.map(([x,y,sx,sy])=>[idx(x,y),Buffer.from(frame.slice(off(sx,sy),off(sx,sy)+4))]));
  for(const version of ['v86','v87']){
   const moduleBytes=fs.readFileSync(path.join(__dirname,`native_underlay_${version}.wasm`));
   const memory=new WebAssembly.Memory({initial:200});
   const {instance}=await WebAssembly.instantiate(moduleBytes,{env:{memory}});
   const dv=new DataView(memory.buffer),set=(p,x)=>dv.setUint32(p,x>>>0,true);
   set(LIST+12,2);set(LIST+16,LAYER);set(LIST+20,GUN);set(LAYER+12,LEN);set(GUN+12,LEN);
   const src=new Uint8Array(memory.buffer,LAYER+16,LEN*4),gp=new Uint8Array(memory.buffer,GUN+16,LEN*4);
   const mask=gun;
   for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const j=off(x,y),k=idx(x,y)*4;
    if(mask[j+3]===0)src.set(frame.subarray(j,j+4),k);
    gp.set(mask.subarray(j,j+4),k);
   }
   const origSrc=Buffer.from(src),origGun=Buffer.from(gp);
   const value=instance.exports.phm_native_underlay(LIST,GUN,0);
   assert.equal(value,version==='v86'?-3:5000+t.id,`${t.name} ${version}: status`);checks++;
   assert.deepEqual(Buffer.from(gp),origGun,`${t.name} ${version}: gun unchanged`);checks++;
   for(let k=0;k<LEN;k++){
    const actual=src.subarray(k*4,k*4+4),baseline=origSrc.subarray(k*4,k*4+4);
    const expect=(version==='v87')?targets.get(k):null;
    if(expect){assert.deepEqual(Buffer.from(actual),expect,`${t.name} ${version}: target ${k}`);checks++}
    else if(!Buffer.from(actual).equals(baseline))throw Error(`${t.name} ${version}: changed outside target at atlas idx ${k}`);
   }
   checks++;
   if(version==='v87'){
    // Full-shape match alone must NOT bypass per-pixel target alpha preconditions.
    const [x,y]=t.patch[0];const p=idx(x,y)*4;
    src.set(origSrc);src[p+3]=src[p+3]===0?255:0;const before=Buffer.from(src);
    assert.ok(instance.exports.phm_native_underlay(LIST,GUN,0)<0,`${t.name} guard must reject changed shape or target alpha`);checks++;
    assert.deepEqual(Buffer.from(src),before,`${t.name} guard leaves all bytes`);checks++;
   }
   console.log(`PASS ${version} / ${t.name}: ${value}`);
  }
 }
 console.log(`ALL ${checks} real v86 exported sprite / compiled native WASM checks passed`);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
