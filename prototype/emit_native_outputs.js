'use strict';
// Recompute the prototype outputs by invoking the compiled native WASM module.
const fs=require('node:fs'),path=require('node:path');
const root=__dirname, f=JSON.parse(fs.readFileSync(path.join(root,'fixtures.json')));
const moduleBytes=fs.readFileSync(path.join(root,'corrective_underlay.wasm'));
(async()=>{
 const {instance}=await WebAssembly.instantiate(moduleBytes);
 const {memory,apply_underlay}=instance.exports;
 const src=65536,gun=src+16384,dst=gun+16384,view=new Uint8Array(memory.buffer);
 const base64Decode=s=>new Uint8Array(Buffer.from(s,'base64'));
 fs.mkdirSync(path.join(root,'examples'),{recursive:true});
 for(const e of f.cases){
  view.set(base64Decode(e.current),src);view.set(base64Decode(f.occlusionMask),gun);
  const changed=apply_underlay(src,gun,dst,e.item,f.firearmSourceTexturePathID);
  const filename=e.name.replace(/ /g,'-')+'.rgba';
  fs.writeFileSync(path.join(root,'examples',filename),view.slice(dst,dst+16384));
  console.log('Generated',filename,'ops',changed);
 }
})().catch(e=>{console.error(e);process.exitCode=1});
