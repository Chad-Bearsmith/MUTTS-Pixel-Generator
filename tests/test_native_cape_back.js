'use strict';
// Isolated execution of the exact patched native IL2CPP/WebAssembly helper body.
// Fixtures are synthetic, NOT Unity gameplay tests.
const fs=require('fs'),assert=require('assert');
const path=require('path');
const bytes=fs.readFileSync(path.join(__dirname,'..','test-native-helper.wasm'));
const PIXELS=534528,REF=486171,MARKERS=497088;
const c={green:0xff5fe699,green2:0xff357b33,red:0xff002cff,blue:0xffd85c04,black:0xff000000,gray:0xff5d5d5d,orange:0xff2983ed,marker:0xfe0a1ec8};
let n=0;
async function scenario(name,options={}){
 const o={layers:['back','body','cape','gun'],markerCount:7,arm104:null,arm108:null,ref:{body:c.green,back:c.blue,cape:c.red},...options};
 const {instance}=await WebAssembly.instantiate(bytes);const e=instance.exports;
 const view=new DataView(e.memory.buffer), put=(p,x)=>view.setUint32(p,x>>>0,true),get=(p)=>view.getUint32(p,true);
 const ctx=0xA40000, list=0xC0000,ptr={back:0x200000,body:0x410000,cape:0x620000,gun:0x830000,other:0x1600000};
 for(const [k,p] of Object.entries(ptr)){
  put(p+12,PIXELS);if(o.ref[k]!=null)put(p+16+REF*4,o.ref[k]);
 }
 if(o.markerCount){for(let i=0;i<o.markerCount;i++)put(ptr.gun+16+(MARKERS+i)*4,c.marker)}
 const layerPtr=o.layers.map(x=>ptr[x]);put(list+12,layerPtr.length);layerPtr.forEach((v,i)=>put(list+16+i*4,v));
 assert.equal(e.test(0,1,ctx),0,'native diagnostic initialization');
 const tags=[];if(o.layers.includes('back')||o.emitBackTag)tags.push([101,o.badBackPtr||ptr.back]);
 if(o.layers.includes('cape')||o.emitCapeTag)tags.push([111,o.badCapePtr||ptr.cape]);
 put(ctx+409664,tags.length);put(ctx+409672,0x50363956);
 tags.forEach(([tag,p],i)=>{put(ctx+409680+i*20,tag);put(ctx+409692+i*20,p)});
 // Real native helper consults fresh source flags and these source buffers.
 put(ctx+446608,1);put(ctx+446612,o.arm108!=null?1:0);
 if(o.absenceTag){e.test(0,310,ctx);}
 else if(o.rejectedOverlay){e.test(0,308,ctx);}
 else if(o.arm108==null){put(ctx+411668,1);}
 if(o.arm104!=null)put(ctx+2584832+REF*4,o.arm104);
 if(o.arm108!=null)put(ctx+4722944+REF*4,o.arm108);
 const gunBefore=new Uint8Array(e.memory.buffer,ptr.gun+16,PIXELS*4).slice();
 const sampleBefore={back:get(ptr.back+16+REF*4),cape:get(ptr.cape+16+REF*4),body:get(ptr.body+16+REF*4)};
 assert.equal(e.test(list,ptr.gun,ctx),0,'native reconstruction');
 const status=get(ctx+446696),chosen=get(ctx+446704),original=get(ctx+446640),changed=get(ctx+446716),count=get(ctx+446712);
 const actual=[];for(let i=0;i<o.markerCount;i++)actual.push(get(ptr.gun+16+(MARKERS+i)*4));
 const result={status,chosen,original,changed,count,actual,fullStatus:get(ctx+446616)};
 assert.equal(result.status,o.expectedStatus??1,`native status for ${name}`);
 if(o.expectedReference!=null)assert.equal(result.chosen,o.expectedReference,`filtered reference for ${name}`);
 if(o.expectedOriginal!=null)assert.equal(result.original,o.expectedOriginal,`unfiltered original for ${name}`);
 if(result.status===1){assert.equal(changed,o.markerCount,`${name} changed marker count`);assert.equal(count,o.markerCount,`${name} detected marker count`);for(const mark of actual)assert.equal(mark,((o.expectedReference&0xffffff)|0xfe000000)>>>0,`${name} recolored marker RGB and preserved alpha 254`);}
 else for(const mark of actual)assert.equal(mark,c.marker,`${name} unsupported combinations preserve markers`);
 assert.deepEqual({back:get(ptr.back+16+REF*4),cape:get(ptr.cape+16+REF*4),body:get(ptr.body+16+REF*4)},sampleBefore,`${name} original character layers must not change`);
 const gunAfter=new Uint8Array(e.memory.buffer,ptr.gun+16,PIXELS*4);
 let unexpected=0;for(let j=0;j<gunBefore.length;j++){const pixel=j>>>2;if(pixel>=MARKERS&&pixel<MARKERS+o.markerCount)continue;if(gunBefore[j]!==gunAfter[j])unexpected++;}
 assert.equal(unexpected,0,`${name} no firearm pixels outside synthetic hand marker set may be changed`);
 n++;console.log('PASS',name,`status=${status}, chosen=${chosen.toString(16)}, old=${original.toString(16)}`);
}
(async()=>{
 await scenario('no Cape or Back, original body reference',{layers:['body','gun'],expectedReference:c.green,expectedOriginal:c.green});
 await scenario('Cape only overlays reference',{layers:['body','cape','gun'],expectedReference:c.green,expectedOriginal:c.red});
 await scenario('Back only overlays reference',{layers:['body','back','gun'],expectedReference:c.green,expectedOriginal:c.blue});
 await scenario('both Cape and Back overlay reference',{expectedReference:c.green,expectedOriginal:c.red});
 await scenario('Cape alpha transparent at reference',{ref:{body:c.green,back:c.blue},expectedReference:c.green,expectedOriginal:c.green});
 await scenario('Back alpha transparent, Cape overlays',{ref:{body:c.green,cape:c.red},expectedReference:c.green,expectedOriginal:c.red});
 await scenario('Cape and Back behind opaque body',{layers:['back','cape','body','gun'],expectedReference:c.green,expectedOriginal:c.green});
 await scenario('104 current arm-source swatch overrides body', {arm104:c.orange,expectedReference:c.orange,expectedOriginal:c.orange});
 await scenario('108 current glove-source swatch overrides arm', {arm104:c.green,arm108:c.gray,expectedReference:c.gray,expectedOriginal:c.gray});
 await scenario('absent overlay reported by native lookup uses current arm swatch', {
   arm104:c.green2,absenceTag:true,expectedReference:c.green2,expectedOriginal:c.green2,
 });
 await scenario('failed selected overlay capture still skips', {
   arm104:c.green2,rejectedOverlay:true,expectedStatus:2,
 });
 await scenario('genuinely opaque black body remains black',{ref:{body:c.black,back:c.blue,cape:c.red},expectedReference:c.black,expectedOriginal:c.red});
 await scenario('different body color swatch',{ref:{body:c.green2,back:c.blue,cape:c.red},expectedReference:c.green2,expectedOriginal:c.red});
 await scenario('unrelated layer remains eligible for reference',{layers:['back','body','other','gun'],ref:{body:c.green,back:c.blue,other:c.orange},expectedReference:c.orange,expectedOriginal:c.orange});
 await scenario('9 alpha-254 marker variant',{markerCount:9,expectedReference:c.green,expectedOriginal:c.red});
 await scenario('unexpected marker count fails closed',{markerCount:6,expectedStatus:6,expectedReference:c.green,expectedOriginal:c.red});
 await scenario('no surviving body/arm color fails closed',{ref:{back:c.blue,cape:c.red},expectedStatus:4,expectedReference:0,expectedOriginal:c.red});
 await scenario('misidentified Cape pointer fails closed',{badCapePtr:0x150000,expectedStatus:4,expectedReference:0,expectedOriginal:c.red});
 await scenario('misidentified Back pointer fails closed',{badBackPtr:0x150000,expectedStatus:4,expectedReference:0,expectedOriginal:c.red});
 console.log(`PASS ${n} native Cape/Back reference fixtures`);
})().catch(e=>{console.error(e);process.exit(1)});
