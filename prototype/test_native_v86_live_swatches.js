'use strict';
/* Reproduce both REAL user v85 broken color swatches. The PNGs are the actual
   first-idle exports aligned by original Bolt-reference cropped offsets.
   The v85 helper must reject; v86 must apply only target pixels, keeping the
   firearm unchanged. Tests actual live color geometry, not just permutations. */
const fs=require('fs'),path=require('path'), assert=require('assert/strict'),cp=require('child_process');
const root=path.join(__dirname,'..'),fixtures=JSON.parse(fs.readFileSync(path.join(root,'firearms/fixtures-v84.json'),'utf8'));
const bolt=Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures_v82.json'))).boltMask,'base64');
const wasm85=fs.readFileSync(path.join(__dirname,'native_underlay_v85.wasm'));
const wasm86=fs.readFileSync(path.join(__dirname,'native_underlay_v86.wasm'));
const LEN=576*928,LIST=0x100000,LAYER=0x200000,GUN=0x500000;
const idx=(x,y)=>(927-(64+y))*576+x;
const px=(x,y)=>(y*64+x)*4;
const tests=[{name:'Furry Body',file:'SpriteSheet.png',x:22,y:5,id:7,patch:[{x:27,y:18,colorFrom:[28,19]},{x:26,y:19,colorFrom:[25,19]},{x:27,y:19,colorFrom:[25,19]},{x:27,y:20,colorFrom:[28,19]}]},
 {name:'Werewolf Body',file:'SpriteSheet (1).png',x:22,y:4,id:10,patch:[{x:26,y:18,colorFrom:[28,19]},{x:27,y:18,colorFrom:[28,19]},{x:26,y:19,colorFrom:[25,19]},{x:27,y:19,colorFrom:[25,19]},{x:26,y:20,colorFrom:[28,19]},{x:27,y:20,colorFrom:[28,19]}]}];
// python reads the user PNGs and sends raw RGBA bytes, no OCR or external deps.
const py=String.raw`from PIL import Image
import sys
im=Image.open(sys.argv[1]).convert('RGBA')
a=im.tobytes()
assert im.width%20==0 and im.height%20==0
im=im.resize((im.width//20,im.height//20),Image.Resampling.NEAREST)
out=im.tobytes()
# check original is an exact 20x nearest-neighbor scale
assert Image.frombytes('RGBA',im.size,out).resize((im.width*20,im.height*20),Image.Resampling.NEAREST).tobytes()==a
sys.stdout.buffer.write(out)`;
const srcMap = t=>new Uint8Array(cp.execFileSync('python3',['-c',py,path.join(root,'swatch-repros',t.file)],{maxBuffer:1000000}));
(async()=>{
 let checks=0;
 for(const t of tests){
  const img=srcMap(t),side=21;assert.equal(img.length,side*side*4);
  const full=new Uint8Array(64*64*4);
  for(let y=0;y<21;y++)for(let x=0;x<21;x++)full.set(img.slice((y*side+x)*4,(y*side+x)*4+4),px(t.x+x,t.y+y));
  const fixture=fixtures.cases.find(c=>c.id===t.id);
  const defaultImg=new Uint8Array(Buffer.from(fixture.current,'base64'));
  const union=new Uint8Array(64*64);
  for(const w of fixtures.weapons){const gun=Buffer.from(w.rgba,'base64');for(let k=0;k<64*64;k++)if(gun[k*4+3])union[k]=1;}
  for(let k=0;k<64*64;k++)if(!union[k])assert.equal(full[k*4+3]>0,defaultImg[k*4+3]>0,`${t.name}: source silhouette differs at ${k}`);
  const expected={};for(const p of t.patch){const [sx,sy]=p.colorFrom;expected[idx(p.x,p.y)]=[...full.slice(px(sx,sy),px(sx,sy)+4)];}
  for(const [label,wasm] of [['v85',wasm85],['v86',wasm86]]){
    const memory=new WebAssembly.Memory({initial:200});
    const {instance}=await WebAssembly.instantiate(wasm,{env:{memory}});
    const v=new DataView(memory.buffer),set=(at,val)=>v.setUint32(at,val>>>0,true),get=at=>v.getUint32(at,true)>>>0;
    const dst=new Uint8Array(memory.buffer,LAYER+16,LEN*4),gunBytes=new Uint8Array(memory.buffer,GUN+16,LEN*4);
    dst.fill(0);gunBytes.fill(0);
    set(LIST+12,2);set(LIST+16,LAYER);set(LIST+20,GUN);
    set(LAYER+12,LEN);set(GUN+12,LEN);
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      const k=px(x,y),pt=idx(x,y);
      if(!bolt[k+3])for(let ch=0;ch<4;ch++)dst[pt*4+ch]=full[k+ch];
      for(let ch=0;ch<4;ch++)gunBytes[pt*4+ch]=bolt[k+ch];
    }
    const before=dst.slice(),origGun=gunBytes.slice();
    const result=instance.exports.phm_native_underlay(LIST,GUN,0);
    const expectedStatus=(label==='v85'?-3:5000+t.id);
    assert.equal(result,expectedStatus,`${t.name} ${label} status`); checks++;
    assert.deepEqual(gunBytes,origGun,`${t.name} ${label} weapon unchanged`);checks++;
    const siteSet=new Set(t.patch.map(p=>idx(p.x,p.y)));
    for(let i=0;i<LEN;i++){
      if(siteSet.has(i)&&label==='v86'){
        const color=[...dst.slice(i*4,i*4+4)];
        assert.deepEqual(color,expected[i],`${t.name} ${label} target`);
      } else if(!Buffer.from(dst.subarray(i*4,i*4+4)).equals(Buffer.from(before.subarray(i*4,i*4+4)))) {
        throw Error(`${t.name} ${label} edited pixel ${i} unexpectedly`);
      }
    }
    checks++;
    // Native alpha at a target is a separate guard, not only silhouette identity.
    if(label==='v86'){
      const mutant=idx(t.patch[0].x,t.patch[0].y),offset=mutant*4;
      dst.set(before);dst[offset+3]=255;
      const pre=dst.slice();const fail=instance.exports.phm_native_underlay(LIST,GUN,0);
      assert.equal(fail,-7,`${t.name}: modified target fails closed`);
      assert.deepEqual(dst,pre);checks+=2;
    }
    console.log(`PASS ${label} ${t.name}: status ${result}, gun unchanged, expected pixel changes only`);
  }
 }
 console.log(`ALL ${checks} real-export/native-WASM tests PASS`);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
