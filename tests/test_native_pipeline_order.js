'use strict';
// Execute BOTH compiled native functions against the same synthetic Unity arrays.
// Demonstrates v79 overwrite (filtered first) and v80 last-writer result
// (original first), while preserving all non-hand firearm bytes.
const assert=require('assert'),fs=require('fs'),path=require('path');
const wasm=fs.readFileSync(path.join(__dirname,'fixtures','test-native-pair.wasm'));
const PIXELS=534528, REF=486171, MARK=497088,ctx=0xa40000,list=0xc0000;
const ptr={body:0x410000,back:0x200000,cape:0x620000,gun:0x830000};
const c={body:0xff5fe699, gray:0xffb9a192, cape:0xffd85c04, dark:0xff000000, glove:0xff5d5d5d, marker:0xfea1a1a1};
const withMarkerAlpha=x=>((x&0xffffff)|0xfe000000)>>>0;
let passed=0;
async function test(name, layers, colors, expected, markerCount=7, optional108=null){
 const {instance}=await WebAssembly.instantiate(wasm);const e=instance.exports;
 const v=new DataView(e.memory.buffer),get=p=>v.getUint32(p,true),set=(p,x)=>v.setUint32(p,x>>>0,true);
 for(const [k,p] of Object.entries(ptr)){
  set(p+12,PIXELS);set(p+16+REF*4,colors[k]??0);
 }
 for(let i=0;i<markerCount;i++)set(ptr.gun+16+(MARK+i)*4,c.marker);
 set(list+12,layers.length);layers.forEach((k,i)=>set(list+16+i*4,ptr[k]));
 e.corrected(0,1,ctx); // native metadata initialization
 const tags=layers.filter(k=>k==='back'||k==='cape').map(k=>[k==='back'?101:111,ptr[k]]);
 set(ctx+409664,tags.length);set(ctx+409672,0x50363956);
 tags.forEach(([tag,p],i)=>{set(ctx+409680+i*20,tag);set(ctx+409692+i*20,p)});
 set(ctx+446608,1);set(ctx+446612,optional108===null?0:1);
 if(optional108===null)set(ctx+411668,1);else set(ctx+4722944+REF*4,optional108);
 const source= new Uint8Array(e.memory.buffer,ptr.gun+16,PIXELS*4).slice();
 const markers=()=>Array.from({length:markerCount},(_,i)=>get(ptr.gun+16+(MARK+i)*4));
 const reset=()=>{for(let i=0;i<markerCount;i++)set(ptr.gun+16+(MARK+i)*4,c.marker)};
 e.corrected(list,ptr.gun,ctx);
 assert.strictEqual(get(ctx+446696),1,`${name}: filtered correction status`);
 const afterFiltered=markers();assert(afterFiltered.every(x=>x===withMarkerAlpha(expected)),`${name}: correct helper reference`);
 e.original(list,ptr.gun);
 const overwritten=markers();
 const originalSource=layers.filter(k=>k!=='gun').map(k=>colors[k]||0).filter(x=>(x>>>24)>0).at(-1);
 assert(overwritten.every(x=>x===withMarkerAlpha(originalSource)),`${name}: older routine uses unfiltered color`);
 if(originalSource!==expected)assert.notDeepEqual(overwritten,afterFiltered,`${name}: v79 overwrites intended color`);
 reset();
 e.original(list,ptr.gun);
 e.corrected(list,ptr.gun,ctx);
 assert.strictEqual(get(ctx+446696),1,`${name}: final correction status`);
 assert(markers().every(x=>x===withMarkerAlpha(expected)),`${name}: reordered pipeline gives correct marker RGB`);
 const changed=new Uint8Array(e.memory.buffer,ptr.gun+16,PIXELS*4), markerSet=new Set(Array.from({length:markerCount},(_,i)=>MARK+i));
 for(let i=0;i<PIXELS;i++)if(!markerSet.has(i)){
  const o=i*4;for(let j=0;j<4;j++)assert.strictEqual(source[o+j],changed[o+j],`${name}: wrong write at pixel ${i}`);
 }
 passed++;console.log('PASS',name,'original',originalSource.toString(16),'corrected',expected.toString(16),'markers',markerCount);
}
(async()=>{
 await test('Back gray versus green body',['body','back','gun'],{body:c.body,back:c.gray},c.body);
 await test('Cape contrast versus green body',['body','cape','gun'],{body:c.body,cape:c.cape},c.body);
 await test('Back + Cape last-wins original versus body',['body','back','cape','gun'],{body:c.body,back:c.gray,cape:c.cape},c.body);
 await test('Black body color valid with Back',['body','back','gun'],{body:c.dark,back:c.gray},c.dark,9);
 await test('Current glove source108 overrides Back',['body','back','gun'],{body:c.body,back:c.gray},c.glove,7,c.glove);
 await test('No excluded categories retains original behavior',['body','gun'],{body:c.body},c.body);
 console.log('PASS',passed,'combined native pipeline-order fixtures');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
