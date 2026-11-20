'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','tests/v88-item-layer-fixtures.json')));
const LEN=576*928,LIST=0x100000,BASE=0x300000,STEP=0x250000,at=(x,y)=>(927-(64+y))*576+x;
const wasm=fs.readFileSync(path.join(__dirname,'native_underlay_v89.wasm'));
async function run(c,options={}){
 const memory=new WebAssembly.Memory({initial:420});
 const {instance}=await WebAssembly.instantiate(wasm,{env:{memory}});
 const view=new DataView(memory.buffer), set=(p,n)=>view.setUint32(p,n>>>0,true);
 const src=c.sources.map(q=>({name:q.asset,rgba:Buffer.from(q.rgba,'base64')}));
 if(options.removeOne)src.pop();
 if(options.duplicate)src.push({...src[0],rgba:Buffer.from(src[0].rgba)});
 if(options.swatch)for(const s of src)for(let k=0;k<s.rgba.length;k+=4){
  if(s.rgba[k+3]){
   const r=s.rgba[k],g=s.rgba[k+1],b=s.rgba[k+2];
   s.rgba[k]=(r*7+g*3+23)%256;s.rgba[k+1]=(b*5+g*7+11)%256;s.rgba[k+2]=(g*9+r*2+19)%256;
  }
 }
 const gun=Buffer.from(data.boltRGBA,'base64'), gunPtr=BASE+src.length*STEP;
 set(LIST+12,src.length+1);
 const layerPtrs=src.map((s,i)=>BASE+i*STEP);
 const fill=(ptr,buf)=>{
  set(ptr+12,LEN);const dest=new Uint8Array(memory.buffer,ptr+16,LEN*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++)dest.set(buf.subarray((y*64+x)*4,(y*64+x)*4+4),at(x,y)*4);
 };
 for(let i=0;i<src.length;i++){set(LIST+16+i*4,layerPtrs[i]);fill(layerPtrs[i],src[i].rgba)}
 set(LIST+16+src.length*4,gunPtr);fill(gunPtr,gun);
 const copy=(ptr)=>Buffer.from(new Uint8Array(memory.buffer,ptr+16,LEN*4));
 const before=layerPtrs.map(copy),beforeGun=copy(gunPtr);
 const status=instance.exports.phm_native_underlay(LIST,gunPtr,0);
 const after=layerPtrs.map(copy);
 assert.deepEqual(copy(gunPtr),beforeGun,'gun unchanged');
 const diffs=[];for(let i=0;i<src.length;i++)for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  const p=at(x,y)*4;
  if(!before[i].subarray(p,p+4).equals(after[i].subarray(p,p+4)))diffs.push({i,x,y,pixel:[...after[i].subarray(p,p+4)]});
 }
 return {status,src,before,after,diffs,gun};
}
(async()=>{
 let passes=0;
 for(const c of data.cases){
  for(const recolor of [false,true]){
   const r=await run(c,{swatch:recolor});
   assert.ok(r.status>0,`${c.name} status ${recolor?'swatch':'default'} ${r.status}`);passes++;
   const wanted=new Map(c.changes.map(q=>[[q.x,q.y].join(','),q]));
   const affectedCoords=new Set(r.diffs.map(q=>q.x+','+q.y));
   assert.ok(r.diffs.length>0,`${c.name} modified no source pixel`);passes++;
   assert.ok(r.diffs.every(q=>wanted.has([q.x,q.y].join(','))),`${c.name} edited outside correction ${JSON.stringify(r.diffs)}`);passes++;
   if(!recolor){
    if(c.item!==3){
     const donor=r.src[0].rgba;
     const expected=r.diffs.filter(q=>q.i===0).map(q=>q.pixel);
     for(const q of r.diffs){
      const w=wanted.get(q.x+','+q.y);
      if(r.status>=8000){assert.deepEqual(q.pixel,w.after,`${c.name} (${q.x},${q.y}) expected original target color`);passes++;}
     }
    }else for(const q of r.diffs){assert.equal(q.pixel[3],0,'Apache only clears original alpha');passes++;}
   }
   console.log('PASS item',c.item,c.name,recolor?'swatch':'default','status',r.status,'writes',r.diffs.length);
  }
 }
 console.log('TOTAL',passes,'native source-match item tests passed');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
