'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const R=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(R,'tests/v89-uploaded-layer-fixtures.json')));
const N=576*928,OFF=(x,y)=>(927-64-y)*576+x, FIRST=0x100000, SRC=0x300000, STEP=0x250000;
const EXPECT={1:{id:4,sites:['27,18','27,19','27,20','27,21']},2:{id:6,sites:['26,14','37,14','25,15','26,15','37,15','38,15','25,16','26,16','27,16','37,16','38,16','27,17','27,18','27,19','27,20','27,21']},3:{id:3,sites:['27,17']},4:null,5:{id:7,sites:['27,18','26,19','27,19','27,20']}};
(async()=>{
  let passed=0;
  const helper=fs.readFileSync(path.join(__dirname,'native_underlay_v91.wasm'));
  const gun=Buffer.from(JSON.parse(fs.readFileSync(path.join(R,'tests/v88-native-trace-fixtures.json'))).boltRGBA,'base64');
  const dracula=data.cases[1];
  const cases=data.cases.map((c,j)=>({...c,expected:EXPECT[j+1]}));
  cases.push(
    {...dracula,file:'Dracula with swatched atlas highlight',expected:EXPECT[2],anchor:[0,30,52,255],highlight:[0,30,52,255]},
    {...dracula,file:'Dracula with unavailable atlas highlight',expected:EXPECT[2],anchor:[0,30,52,0],highlight:[0,0,0,0]},
  );
  for(const c of cases){
    const memory=new WebAssembly.Memory({initial:420});
    const dv=new DataView(memory.buffer); const set=(p,v)=>dv.setUint32(p,v>>>0,true);
    const fill=(idx,raw)=>{const ptr=SRC+idx*STEP;set(ptr+12,N);const a=new Uint8Array(memory.buffer,ptr+16,N*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const v=(64*y+x)*4,at=OFF(x,y)*4;a.set(raw.subarray(v,v+4),at);}return a;};
    set(FIRST+12,c.layers.length+1);let arr=[];
    for(let i=0;i<c.layers.length;i++){set(FIRST+16+4*i,SRC+i*STEP);arr.push(fill(i,Buffer.from(c.layers[i],'base64')));}
    const anchorOffset=((927-338)*576+29)*4;
    if(c.anchor){
      // Slot 1 contains the recognized Dracula donor in the second trace.
      arr[1].set([0,21,41,255],OFF(27,22)*4);
      arr[1].set(c.anchor,anchorOffset);
    }
    const gunIndex=c.layers.length;set(FIRST+16+4*gunIndex,SRC+gunIndex*STEP);const g=fill(gunIndex,gun),preGun=Buffer.from(g);
    const pre=arr.map(a=>Buffer.from(a));
    const {instance}=await WebAssembly.instantiate(helper,{env:{memory}});
    const status=instance.exports.phm_native_underlay(FIRST,SRC+gunIndex*STEP,0);
    assert.deepEqual(Buffer.from(g),preGun,c.file+' weapon is unchanged');passed++;
    const change=[];
    for(let i=0;i<arr.length;i++)for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      let at=OFF(x,y)*4;
      if(!arr[i].subarray(at,at+4).every((a,k)=>a===pre[i][at+k]))change.push(`${x},${y}`);
    }
    const exp=c.expected;
    if(exp){assert.equal(status,8000+exp.id,c.file+' native status');passed++;assert.ok(change.length>0,c.file+' changed');passed++;assert.ok(change.every(x=>exp.sites.includes(x)),c.file+' changes only intended points: '+change);passed++;}
    else {assert.ok(status<0,c.file+' safely skipped without distinct identity');passed++;assert.deepEqual(arr.map(a=>Buffer.from(a)),pre,c.file+' no unrelated writes');passed++;}
    if(c.highlight){
      const target=OFF(26,15)*4;
      assert.deepEqual(Array.from(arr[1].subarray(target,target+4)),c.highlight,c.file+' uses only a verified highlight');passed++;
      assert.deepEqual(Array.from(arr[1].subarray(anchorOffset,anchorOffset+4)),c.anchor,c.file+' preserves the source sample');passed++;
    }
    console.log(c.file,'prior',c.underlay,'new',status,'changed',change.length);
  }
  console.log('PASS uploaded v88 layer repros',passed);
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
