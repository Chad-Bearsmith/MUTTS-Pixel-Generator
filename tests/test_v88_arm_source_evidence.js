'use strict';
/* Read-only v88 arm metadata: invalid source108 does not turn into a guessed body/skin color. */
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const js=fs.readFileSync(path.join(__dirname,'fixtures/legacy-web/phm-v76-layer-provenance.js'),'utf8');
const memory=new WebAssembly.Memory({initial:512}),dst=0x1000000;
const view=new DataView(memory.buffer),set=(p,v)=>view.setUint32(p,v>>>0,true);
const STRIDE=64*64*4,FRAME_TOTAL=64+25*STRIDE,FULL_META=FRAME_TOTAL+4096+64+2*STRIDE;
const FULL_DATA=FULL_META+128, ATLAS_BYTES=576*928*4;
set(dst+FULL_META,0x73337350);
set(dst+FULL_META+16,1); // required arm104 fresh
set(dst+FULL_META+20,0); // selected arm108 not fresh
set(dst+FULL_META+104,2); // native correction safely skipped
set(dst+FRAME_TOTAL+1984+20,0); // optional arm108 absence NOT proven
const loc=(x,y)=>((928-1-(64+y))*576+x)*4;
const src104=dst+FULL_DATA+ATLAS_BYTES;
new Uint8Array(memory.buffer,src104+loc(27,19),4).set([99,88,77,255]);
const checkBytewise=(start,n)=>Buffer.from(new Uint8Array(memory.buffer,start,n));
const originalMeta=checkBytewise(dst+FULL_META,128),original104=checkBytewise(src104+loc(27,19),4);
const window={}, document={readyState:'loading',addEventListener:()=>{},getElementById:()=>null};
const sandbox={window,document,WebAssembly,Uint8Array,Uint8ClampedArray,DataView,Math,Array,Number,Blob,Map,Set,Date,JSON,console};
vm.runInNewContext(js,sandbox,{filename:'phm-v76-layer-provenance.js'});
const mod={asm:{Oh:memory,phm_v64_snapshot_destination:{value:0},phm_v64_snapshot_serial:{value:1},phm_underlay_status:{value:-3}},_malloc:()=>dst};
window.PHMV76LayerProvenance.setModule(mod);
const status=window.PHMV76LayerProvenance.automaticIdleStatus();
assert.equal(status.status,2);
assert.equal(status.referenceColor,null);
assert.equal(status.nativeArmSourceEvidence.available,true);
assert.equal(status.nativeArmSourceEvidence.source104Fresh,true);
assert.equal(status.nativeArmSourceEvidence.source108Fresh,false);
assert.equal(status.nativeArmSourceEvidence.source108SelectedButUnavailable,true);
assert.equal(status.nativeArmSourceEvidence.source108OptionalAbsentProven,false);
assert.equal(status.nativeArmSourceEvidence.source108Samples,null);
assert.equal(status.nativeArmSourceEvidence.source104Samples[0].rgba.join(','),'99,88,77,255');
assert.deepEqual(checkBytewise(dst+FULL_META,128),originalMeta,'read-only metadata');
assert.deepEqual(checkBytewise(src104+loc(27,19),4),original104,'read-only source104');
set(dst+FRAME_TOTAL+1984+20,1);
const absent=window.PHMV76LayerProvenance.automaticIdleStatus();
assert.equal(absent.nativeArmSourceEvidence.source108SelectedButUnavailable,false);
assert.equal(absent.nativeArmSourceEvidence.source108OptionalAbsentProven,true);
console.log('PASS v88 hand source evidence: native status2, guarded overlay absence, source samples, no native writes');
