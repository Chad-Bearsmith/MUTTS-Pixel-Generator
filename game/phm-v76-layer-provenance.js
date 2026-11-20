/* Pixel Hero Maker [v.76] — automatic first-idle-frame hand recolor.
   Native reconstruction uses current source 104 plus source 108 when selected; null optional overlays are treated as absent, not as errors.
   No manual unarmed capture is needed. Other frames remain unchanged by the
   new idle-only correction; old comparison diagnostics remain optional. */
(() => { 'use strict';
 // Since v78, legacy JS hand-color writers have been physically removed.
 // v85 retains v84 firearm/hand behavior and adds an alpha/relative-color appearance guard for swatch-aware first-idle item underlays.
 // The native v76 idle resolver remains the only hand-color writer.
 const F=64, STRIDE=F*F*4, HEAD=64, MAX=24, FRAME_TOTAL=HEAD+(MAX+1)*STRIDE, TRACE_SIZE=4096, EXTRA_SIZE=64+2*STRIDE, TOTAL=FRAME_TOTAL+TRACE_SIZE+EXTRA_SIZE+128+4*576*928*4;
 const appendSites={101:'0x1574d2',102:'0x15753d',103:'0x1575b2',104:'0x157628',105:'0x157693',106:'0x15772c',107:'0x1577a1',108:'0x15780c',109:'0x157877',110:'0x157915',111:'0x157980',112:'0x1579eb',113:'0x157a56',114:'0x157ca4',115:'0x157d0f',116:'0x157d92',118:'0x1581a7',119:'0x158377'};
 const MAGIC=0x50484d68, ARRAY_PIXELS=576*928;
 const ATLAS_W=576,ATLAS_H=928,ATLAS_BYTES=ARRAY_PIXELS*4;
 const OLD_TOTAL=FRAME_TOTAL+TRACE_SIZE+EXTRA_SIZE,FULL_META=OLD_TOTAL,FULL_DATA=FULL_META+128;
 const FULL_MAGIC=0x73337350;

 const $=id=>document.getElementById(id);
 let mod=null,dst=0,error=null,unarmed=null,armed=null;
 const rgba=v=>[(v&255),((v>>>8)&255),((v>>>16)&255),((v>>>24)&255)];
 const hx=v=>(v>>>0).toString(16).padStart(8,'0');
 function f32(asm,n){const g=asm?.[n];if(!g||typeof g.value!=='number')throw Error('Missing Unity diagnostic export '+n);return g.value>>>0;}
 function setup(m){
  if(!m?.asm?.phm_v64_snapshot_destination||typeof m._malloc!=='function')return false;
  if(dst && m.asm.phm_v64_snapshot_destination.value===dst)return true;
  dst=m._malloc(TOTAL)>>>0;if(!dst)throw Error('Could not allocate persistent diagnostic buffer');
  m.asm.phm_v64_snapshot_destination.value=dst;
  return true;
 }
 function hash(bytes){let h=2166136261>>>0;for(const b of bytes)h=Math.imul((h^b)>>>0,16777619)>>>0;return hx(h);}
 function stats(bytes){let opaque=0,transparent=0,translucent=0,minX=F,minY=F,maxX=-1,maxY=-1;
  for(let i=3;i<bytes.length;i+=4){const a=bytes[i];if(a===255)opaque++;else if(a===0)transparent++;else translucent++;
   if(a){const k=(i-3)/4,x=k%F,y=Math.floor(k/F);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
  return {opaque,transparent,translucent,visibleBounds:maxX<0?null:[minX,minY,maxX,maxY],checksumFnv1a32:hash(bytes)};
 }
 const idx=(x,y)=>(y*F+x)*4;
 function readPixel(bytes,x,y){return Array.from(bytes.slice(idx(x,y),idx(x,y)+4));}
 function buildComposite(layers,exclude){
  const out=new Uint8ClampedArray(STRIDE);
  for(let i=0;i<layers.length;i++){
   if(i===exclude)continue;
   const src=layers[i];for(let p=0;p<STRIDE;p+=4){if(src[p+3]){
    out[p]=src[p];out[p+1]=src[p+1];out[p+2]=src[p+2];out[p+3]=src[p+3];
   }}
  }return out;
 }

 // Full atlas is a native-synchronous copy; never reread Unity's temporary pointers.
 // Bytes are in Unity's bottom-up Color32[] order; PNG export reverses rows.
 function sampleAtlas(bytes,x,y){const p=((ATLAS_H-1-(64+y))*ATLAS_W+x)*4;return Array.from(bytes.slice(p,p+4));}
 function fullMetaRead(view,mem,want){
  const base=dst+FULL_META,rd=i=>view.getUint32(base+i,true);
  if(rd(0)!==FULL_MAGIC || rd(92)!==ARRAY_PIXELS)throw Error('Full atlas native snapshot not initialized; trigger a fresh rebuild');
  const status=rd(24),valid=status===1||status===4;
  const info={format:'PixelHero-v90-FullAtlas-1',dimensions:[ATLAS_W,ATLAS_H],totalPixels:ARRAY_PIXELS,
   source:'Native synchronous merge excluding Firearm; armed path adds source104 and the optional source108 when selected',
   nativeStatus:status, statusDescription:({0:'not attempted',1:'full reconstruction and unarmed-baseline comparison completed',2:'skipped: required source missing or expected optional source failed to generate',3:'skipped: firearm layer is not last',4:'reconstructed, but no genuine unarmed baseline exists'})[status]||'unknown',
   unarmedCaptureCount:rd(4),armedCaptureCount:rd(8),hasUnarmedBaseline:rd(12)===1,
   freshArm104:rd(16)===1,freshArm108:rd(20)===1,optionalArm108Absent:view.getUint32(dst+FRAME_TOTAL+1984+20,true)===1,
   unarmedLayerCount:rd(60),armedLayerCount:rd(64),firearmSlot:rd(68),probeAttempt:rd(72),
   baselineHash:hx(rd(36)),reconstructedHash:hx(rd(40)),arm104FullHash:hx(rd(84)),arm108FullHash:hx(rd(88)),
   nativePixelDifferences:status===1?rd(28):null,firstMismatchAtlasArrayIndex:status===1?(rd(32)===0xffffffff?null:rd(32)):null,
   originalUnityReference:[27,19],nativeUnarmedReference:rgba(rd(44)),nativeReconstructedReference:valid?rgba(rd(48)):null,
   nativeUnarmedShiftedReference:rgba(rd(96)),nativeReconstructedShiftedReference:valid?rgba(rd(100)):null,
   comparisonMayBeStaleIfSwatchesChanged:true};
  const off=want==='unarmed'?0:3*ATLAS_BYTES;
  if(want==='armed'&&!valid)return {info,bytes:null};
  if(want==='unarmed'&&!info.hasUnarmedBaseline)throw Error('No native full-atlas unarmed baseline for this capture');
  const bytes=Uint8Array.from(new Uint8Array(mem.buffer,dst+FULL_DATA+off,ATLAS_BYTES));
  const calculated=hash(bytes),expected=want==='unarmed'?info.baselineHash:info.reconstructedHash;
  info.jsFullHash=calculated;info.nativeFullHashVerified=calculated===expected;
  info.jsReference=sampleAtlas(bytes,27,19);info.jsShiftedReference=sampleAtlas(bytes,28,20);
  if(!info.nativeFullHashVerified)throw Error('Native full atlas and JavaScript checksum disagree');
  const ref=want==='unarmed'?info.nativeUnarmedReference:info.nativeReconstructedReference;
  if(!info.jsReference.every((v,k)=>v===ref[k]))throw Error('Native full atlas reference pixel mismatches copied bytes');
  return {info,bytes};
 }
 function pixelCompareFull(a,b){if(a.length!==b.length)throw Error('Atlas comparison buffers have different lengths');let different=0,first=null;
  for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3]){
   different++;if(first===null)first=i/4;
  }
  return {different,first};
 }
 function extractFirstFrame(raw){const frame=new Uint8ClampedArray(STRIDE);
  for(let y=0;y<F;y++)for(let x=0;x<F;x++){
   const src=((ATLAS_H-1-(64+y))*ATLAS_W+x)*4,dst=(y*F+x)*4;
   frame[dst]=raw[src];frame[dst+1]=raw[src+1];frame[dst+2]=raw[src+2];frame[dst+3]=raw[src+3];
  }return frame;
 }
 function readSnapshot(want){
  const m=mod||window.gameInstance?.Module||window.PHMGameInstance?.Module;
  if(!m?.asm)throw Error('Unity has not finished loading');
  if(!setup(m))throw Error('Native snapshot module or malloc unavailable');
  const a=m.asm,mem=a.Oh||m.wasmMemory||a.memory;
  if(!mem?.buffer)throw Error('Unity WebAssembly memory inaccessible');
  const serial=f32(a,'phm_v64_snapshot_serial'),result=f32(a,'phm_v64_snapshot_result');
  if(!serial)throw Error('No rebuild recorded after the diagnostic buffer initialized; change a selection once');
  if(result!==0)throw Error('Native rebuild snapshot rejected (result '+result+'); try a new real selection change');
  const v=new DataView(mem.buffer);
  if(dst+TOTAL>v.byteLength)throw Error('Snapshot buffer outside Unity memory');
  const rd=i=>v.getUint32(dst+i,true);
  if(rd(0)!==MAGIC)throw Error('No complete native snapshot; change an item and try again');
  const n=rd(4),slot=rd(8),headA=rd(12),headB=rd(16),pA=rd(20),pB=rd(24),present=rd(32),stride=rd(36),count=rd(40);
  if(n<1||n>MAX||rd(28)!==ARRAY_PIXELS||stride!==STRIDE||count!==n+1||rd(44)!==64||rd(48)!==F||rd(52)!==F)
   throw Error('Unexpected native snapshot structure');
  if(present!==0&&present!==1)throw Error('Invalid firearm-state flag');
  if((present===0&&slot!==0xffffffff)||(present===1&&slot>=n))throw Error('Firearm buffer identity inconsistent');
  if(want==='unarmed' && present!==0)throw Error('Unity still has a Firearm input. Select the actual None/empty Firearm item, not merely hide its artwork, then rebuild');
  if(want==='armed' && present!==1)throw Error('Unity reports no Firearm input. Equip AK-47 and rebuild before recording');
  const copied=new Uint8Array(STRIDE*(n+1));
  copied.set(new Uint8Array(mem.buffer,dst+HEAD,copied.length));
  if(f32(a,'phm_v64_snapshot_serial')!==serial)throw Error('Unity rebuilt during snapshot read; retry');
  const composite=new Uint8ClampedArray(copied.slice(0,STRIDE));
  const layers=[];for(let i=0;i<n;i++)layers.push(new Uint8ClampedArray(copied.slice((i+1)*STRIDE,(i+2)*STRIDE)));
  const reconstructed=buildComposite(layers,present?slot:-1);
  if(!reconstructed.every((b,i)=>b===composite[i]))throw Error('Native and JavaScript layer composition disagree; no capture saved');
  const samples=[{x:27,y:19},{x:28,y:20}];
  if(!samples.every((q,i)=>{
    const px=readPixel(composite,q.x,q.y);const w=i===0?headA:headB;
    return (px[0]|px[1]<<8|px[2]<<16|px[3]<<24)>>>0 === w;
  }))throw Error('Recorded pixel references disagree with native copy');
  const actualProviders=[pA,pB].map(i=>i===0xffffffff?null:i);
  const provBase=dst+FRAME_TOTAL;
  const provCount=v.getUint32(provBase,true),provOverflow=v.getUint32(provBase+4,true),provMagic=v.getUint32(provBase+8,true);
  if(provMagic!==0x50363956 || provCount>60)throw Error('Missing or invalid native append-path provenance; trigger a fresh normal rebuild');
  const layerPointers=Array.from({length:n},(_,i)=>v.getUint32(provBase+1536+i*4,true)>>>0);
  const appendPathTrace=Array.from({length:provCount},(_,i)=>{
    const p=provBase+16+i*20,tag=v.getUint32(p,true),list=v.getUint32(p+4,true),sz=v.getUint32(p+8,true),last=v.getUint32(p+12,true);
    return {tag,sourceCodeAddress:appendSites[tag]||null,observedListPointer:list,
      observedListSize:sz===0xffffffff?null:sz,
      lastArrayPointer:last||null,
      matchesFinalInputSlots:last?layerPointers.flatMap((t,j)=>t===last?[j]:[]):[],
      note:'Call-site execution and pointer identity only; field/category name not yet proven'};
  });
  // v76: native copies each source Color32[] at append sites 104/108 BEFORE it
  // is added to Unity's list or overwritten by local.tee of metadata.
  const captureBase=provBase+TRACE_SIZE;
  const copyBase=captureBase+64;
  const sourceFrames=[];
  const nativeArmSourceOutputs=(want==='armed'?[304,308]:[204,208]).map((tag,i)=>{
   const h=captureBase+i*32,seen=v.getUint32(h,true),ptr=v.getUint32(h+4,true),len=v.getUint32(h+8,true),code=v.getUint32(h+12,true),fnv=v.getUint32(h+16,true),a=v.getUint32(h+20,true),b=v.getUint32(h+24,true),complete=v.getUint32(h+28,true);
   if(seen!==tag){sourceFrames.push(null);return {site:i===0?104:108,captureTag:tag,executed:false,status:'not-observed',matchesFinalInputSlots:[],pointerMatchesFinalInputSlots:[]};}
   const info={site:i===0?104:108,captureTag:tag,executed:true,sourceArrayPointer:ptr,observedArrayLength:len,status:code===0?'captured':('source-array-rejected-'+code),
     matchesFinalInputSlots:[],pointerMatchesFinalInputSlots:layerPointers.flatMap((p,k)=>p===ptr?[k]:[])};
   if(code!==0 || !complete || len!==ARRAY_PIXELS){sourceFrames.push(null);return info;}
   const frame=Uint8Array.from(new Uint8Array(mem.buffer,copyBase+i*STRIDE,STRIDE));
   sourceFrames.push(frame);
   info.frame={...stats(frame),reference27x19:rgba(a),reference28x20:rgba(b),nativeChecksumFnv1a32:hx(fnv)};
   info.nativeBytesMatchImage=hash(frame)===hx(fnv) && (readPixel(frame,27,19).every((q,j)=>q===rgba(a)[j])) && (readPixel(frame,28,20).every((q,j)=>q===rgba(b)[j]));
   info.matchesFinalInputSlots=layers.flatMap((pixels,k)=>pixels.every((q,j)=>q===frame[j])?[k]:[]);
   if(!info.nativeBytesMatchImage)info.status='captured-but-checksum-mismatch';
   return info;
  });
  if(f32(a,'phm_v64_snapshot_serial')!==serial)throw Error('Unity rebuilt while reading provenance; retry');
  const requestAddr=provBase+1984;
  const shadowProbe={remainingRebuilds:v.getUint32(requestAddr,true),pending:v.getUint32(requestAddr,true)>0,attemptCounter:v.getUint32(requestAddr+4,true),stage:v.getUint32(requestAddr+8,true),armedFieldPointer:v.getUint32(requestAddr+12,true)};
  const full=fullMetaRead(v,mem,want);
  if(want==='armed'&&full.bytes&&unarmed?.fullAtlasBytes){
    const baselineChanged=unarmed.report.fullAtlas.baselineHash!==full.info.baselineHash;
    full.info.baselineCorrespondsToRecordedUnarmed=!baselineChanged;
    if(!baselineChanged){
     const match=pixelCompareFull(unarmed.fullAtlasBytes,full.bytes);
     full.info.jsPixelDifferences=match.different;full.info.jsFirstDifferenceAtlasArrayIndex=match.first;
     full.info.byteExactToGenuineUnarmed=match.different===0;
     if(full.info.nativePixelDifferences!==null&&full.info.nativePixelDifferences!==match.different)
       throw Error('Full atlas mismatch count differs between native and JavaScript');
    }
  }
  if(full.bytes){
    const nativeFirstFrame=extractFirstFrame(full.bytes);
    full.info.firstFrameChecksumFnv1a32=hash(nativeFirstFrame);
    if(want==='unarmed'&&hash(nativeFirstFrame)!==hash(composite))throw Error('Full unarmed atlas first frame disagrees with original 64x64 reconstruction');
    full.info.firstFramePixelDifferencesFromGenuineUnarmed=unarmed&&want==='armed'?pixelCompareFull(unarmed.composite,nativeFirstFrame).different:0;
  }
  const report={kind:want,serial,capturedAt:new Date().toISOString(),
   actualFirearmInputPresent:!!present,firearmLayerSlot:present?slot:null,layerCount:n,
   nativeOriginalReference:{zeroBased:[27,19],rgba:rgba(headA),provider:actualProviders[0]},
   shiftedReference:{zeroBased:[28,20],rgba:rgba(headB),provider:actualProviders[1]},
   composite:stats(composite),inputs:layers.map((pix,i)=>({slot:i,firearmInput:present&&i===slot,...stats(pix),originalReference:readPixel(pix,27,19),shiftedReference:readPixel(pix,28,20)})),
   nativeArmSourceOutputs,shadowProbe,fullAtlas:full.info,
   nativeBuilderAppendTrace:{events:appendPathTrace,overflow:!!provOverflow,finalInputPointers:layerPointers,warning:appendPathTrace.length?null:'No builder append events captured in this rebuild',
     explanation:'Experimental source-site instrumentation. Recorded list size is only reliable when the native object validates as a List. A final-input identity match is evidence of provenance; absence of a match does not imply the append was unrelated.'}};
  const record={composite,layers,sourceFrames,report,fullyArmed:buildComposite(layers,-1),fullAtlasBytes:full.bytes};
  if(want==='unarmed')unarmed=record;else armed=record;
  paint(want,composite);
  enableDownloads();
  return report;
 }
 function paint(which,bytes){const el=$('phm-v76-'+which+'-preview');if(!el?.getContext)return;
  const small=document.createElement('canvas');small.width=F;small.height=F;
  small.getContext('2d').putImageData(new ImageData(bytes,F,F),0,0);
  const c=el.getContext('2d');c.clearRect(0,0,el.width,el.height);c.imageSmoothingEnabled=false;c.drawImage(small,0,0,el.width,el.height);
 }
 function delta(a,b){let pixelsChanged=0,opaqueToTransparent=0,transparentToOpaque=0;
  const examples=[];for(let p=0;p<STRIDE;p+=4){
   if(a[p]!==b[p]||a[p+1]!==b[p+1]||a[p+2]!==b[p+2]||a[p+3]!==b[p+3]){
    pixelsChanged++;if(a[p+3]&&!b[p+3])opaqueToTransparent++;if(!a[p+3]&&b[p+3])transparentToOpaque++;
    if(examples.length<50){const pixel=p/4;examples.push({xy:[pixel%F,Math.floor(pixel/F)],unarmed:Array.from(a.slice(p,p+4)),armedMinusGun:Array.from(b.slice(p,p+4))});}
   }
  }return {pixelsChanged,opaqueToTransparent,transparentToOpaque,first50Differences:examples};
 }
 function doc(){
  if(!unarmed||!armed)throw Error('Record both normal unarmed and AK-47 equipped rebuilds first');
  if(armed.report.serial<=unarmed.report.serial)throw Error('Please record the unarmed state first, then equip AK-47 and record the equipped state');
  const u=unarmed.report,a=armed.report;
  const shadowComparisons=[0,1].map((i)=>{
    const ub=unarmed.sourceFrames[i],ab=armed.sourceFrames[i];
    const uInfo=u.nativeArmSourceOutputs[i],aInfo=a.nativeArmSourceOutputs[i];
    let changedPixels=null,exactFirstFrameMatch=false;
    if(ub&&ab){changedPixels=0;for(let j=0;j<STRIDE;j+=4)if(ub[j]!==ab[j]||ub[j+1]!==ab[j+1]||ub[j+2]!==ab[j+2]||ub[j+3]!==ab[j+3])changedPixels++;exactFirstFrameMatch=changedPixels===0;}
    return {site:i===0?104:108,unarmedStatus:uInfo.status,shadowStatus:aInfo.status,
      exactFirstFrameMatch,changedPixels,unarmedChecksum:uInfo.frame?.checksumFnv1a32||null,armedShadowChecksum:aInfo.frame?.checksumFnv1a32||null};
  });
  const layout=[];const tileInputs=[...unarmed.layers,...armed.layers];
  layout.push({tile:0,description:'normal unarmed composite'});
  for(let i=0;i<u.layerCount;i++)layout.push({tile:layout.length,description:'unarmed input '+i});
  layout.push({tile:layout.length,description:'armed-minus-gun composite'});
  for(let i=0;i<a.layerCount;i++)layout.push({tile:layout.length,description:'equipped input '+i+(i===a.firearmLayerSlot?' (firearm)':'')});
  return {format:'PixelHero-v90-BuilderArrayOutputs-1',build:'Pixel Hero Maker [v.90]',capturedAt:new Date().toISOString(),
   method:'One-shot nonrecursive armed shadow pixel-generation probe from builder source sites 104/108, without final-merge insertion; compares with genuine unarmed output',
   assumptions:['The user did not alter other item selections or swatches between the two captures','A firearm-free normal rebuild contains all parts that Unity normally renders when no firearm is selected'],
   unarmed:u,armed:a,shadowComparisons,
   fullAtlasComparison:{unarmed:u.fullAtlas,armed:a.fullAtlas,
    fullAtlasPixelCount:ARRAY_PIXELS,allAtlasPixelsMatchGenuineUnarmed:a.fullAtlas?.byteExactToGenuineUnarmed??null,
    nativePixelDifferences:a.fullAtlas?.nativePixelDifferences??null,
    requiresSameClothingAndSwatches:true,handRecolorApplied:false},
   comparisons:{unarmedVsEquippedMinusGun:delta(unarmed.composite,armed.composite),
     unarmedVsFullyEquipped:delta(unarmed.composite,armed.fullyArmed),
     note:'The equipped-minus-gun image is not an independent no-firearm reference. Its prior arm/body modifications are retained.'},
   armSourceTileSheet:{width:F*2,height:F*2,tileSize:[F,F],columns:2,tiles:[{tile:0,kind:'unarmed',site:104},{tile:1,kind:'unarmed',site:108},{tile:2,kind:'armed',site:104},{tile:3,kind:'armed',site:108}]},
   sourceTileSheet:{width:4*F,height:Math.ceil(layout.length/4)*F,tileSize:[F,F],columns:4,tiles:layout},
   caution:'Full 576x928 atlas comparison is exact when baseline and current swatches/selections match; any differences can reflect actual customization changes. Additional Unity palette-generation calls may affect caches; native hand-coloring remains unchanged. No gameplay fix performed.'};
 }
 function encodePng(pix,w,h){
  const raw=new Uint8Array(h*(w*4+1));for(let y=0;y<h;y++)raw.set(pix.subarray(y*w*4,(y+1)*w*4),(y*(w*4+1))+1);
  const body=[]; // RFC 1950/1951 stored DEFLATE blocks, supports large contact sheets
  for(let p=0;p<raw.length;){const n=Math.min(65535,raw.length-p);body.push(n===raw.length-p?1:0,n&255,n>>8,(~n)&255,((~n)>>8)&255);for(let i=0;i<n;i++)body.push(raw[p+i]);p+=n;}
  let a=1,b=0;for(let i=0;i<raw.length;i++){a=(a+raw[i])%65521;b=(b+a)%65521;}
  const z=new Uint8Array(body.length+6);z[0]=0x78;z[1]=0x01;z.set(body,2);new DataView(z.buffer).setUint32(z.length-4,((b<<16)|a)>>>0,false);
  const chunk=(name,data)=>{const out=new Uint8Array(12+data.length),dv=new DataView(out.buffer);
   dv.setUint32(0,data.length,false);for(let i=0;i<4;i++)out[i+4]=name.charCodeAt(i);out.set(data,8);
   let crc=0xffffffff;for(let i=4;i<8+data.length;i++){crc^=out[i];for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}dv.setUint32(8+data.length,(crc^0xffffffff)>>>0,false);return out;};
  const hdata=new Uint8Array(13),hd=new DataView(hdata.buffer);hd.setUint32(0,w,false);hd.setUint32(4,h,false);hdata[8]=8;hdata[9]=6;
  const blocks=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',hdata),chunk('IDAT',z),chunk('IEND',new Uint8Array(0))];
  const all=new Uint8Array(blocks.reduce((n,block)=>n+block.length,0));let off=0;for(const x of blocks){all.set(x,off);off+=x.length;}return all;
 }
 function exportPng(which){if(!unarmed||!armed)throw Error('Record both states first');
  let pixels,w,h,name;
  if(which==='comparison'){
   w=192;h=64;name='PixelHero-v90-CompositeComparison.png';pixels=new Uint8ClampedArray(w*h*4);
   [unarmed.composite,armed.composite,armed.fullyArmed].forEach((frame,t)=>{
    for(let y=0;y<F;y++)pixels.set(frame.subarray(y*F*4,(y+1)*F*4),(y*w+t*F)*4);
   });
  }else if(which==='arm-sources'){
   w=F*2;h=F*2;name='PixelHero-v90-ArmSources.png';pixels=new Uint8ClampedArray(w*h*4);
   const frames=[...unarmed.sourceFrames,...armed.sourceFrames];
   frames.forEach((frame,t)=>{if(!frame)return;const ox=(t%2)*F,oy=Math.floor(t/2)*F;
    for(let y=0;y<F;y++)pixels.set(frame.subarray(y*F*4,(y+1)*F*4),((oy+y)*w+ox)*4);
   });
  }else{
   const tiles=[unarmed.composite,...unarmed.layers,armed.composite,...armed.layers];w=F*4;h=F*Math.ceil(tiles.length/4);name='PixelHero-v90-LayerInputs.png';pixels=new Uint8ClampedArray(w*h*4);
   tiles.forEach((frame,t)=>{const ox=(t%4)*F,oy=Math.floor(t/4)*F;
    for(let y=0;y<F;y++)pixels.set(frame.subarray(y*F*4,(y+1)*F*4),((oy+y)*w+ox)*4);
   });
  }
  deliver(new Blob([encodePng(pixels,w,h)],{type:'image/png'}),name);
 }
 function exportFullAtlas(){
  if(!unarmed?.fullAtlasBytes||!armed?.fullAtlasBytes)throw Error('Complete unarmed and armed full-atlas copies required. Check native full-atlas status in JSON');
  const canvas=document.createElement('canvas');canvas.width=ATLAS_W*2;canvas.height=ATLAS_H;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas not available');
  [unarmed.fullAtlasBytes,armed.fullAtlasBytes].forEach((raw,k)=>{
    const pix=new Uint8ClampedArray(ATLAS_BYTES);
    for(let y=0;y<ATLAS_H;y++)pix.set(raw.subarray((ATLAS_H-1-y)*ATLAS_W*4,(ATLAS_H-y)*ATLAS_W*4),y*ATLAS_W*4);
    ctx.putImageData(new ImageData(pix,ATLAS_W,ATLAS_H),k*ATLAS_W,0);
  });
  canvas.toBlob(blob=>{
    if(!blob){status('Full atlas PNG conversion failed');return;}
    deliver(blob,'PixelHero-v90-FullAtlasComparison.png');
  },'image/png');
 }
 function deliver(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);}
 function exportJson(){deliver(new Blob([JSON.stringify(doc(),null,2)],{type:'application/json'}),'PixelHero-v90-BuilderProvenance.json');}
 function enableDownloads(){const ready=!!unarmed&&!!armed&&armed.report.serial>unarmed.report.serial;
  for(const id of ['phm-v76-download-json','phm-v76-download-composite','phm-v76-download-layers','phm-v76-download-arm-sources','phm-v76-download-full-atlas']){
    const x=$(id);if(x)x.disabled=!ready||(id==='phm-v76-download-full-atlas'&&!armed?.fullAtlasBytes);
  }
 }
 function prepareShadow(){
  if(!unarmed)throw Error('Optional comparison requires a genuine unarmed reference first; automatic idle recoloring does not.');
  const m=mod||window.gameInstance?.Module||window.PHMGameInstance?.Module;
  if(!m?.asm||!setup(m))throw Error('Unity diagnostic memory is not available');
  const mem=m.asm.Oh||m.wasmMemory||m.asm.memory;
  if(!mem?.buffer)throw Error('Unity WebAssembly memory inaccessible');
  const p=dst+FRAME_TOTAL+1984;
  if(p+16>mem.buffer.byteLength)throw Error('Shadow request outside Unity memory');
  const v=new DataView(mem.buffer);v.setUint32(p,16,true);
  armed=null;enableDownloads();
  status('Optional comparison requested. Automatic idle recoloring is ALREADY active during every equipped rebuild; this comparison does not enable it.');
 }
 // Read-only output-side cross-check: tracks the currently OBSERVED GPU-uploaded
 // first idle tile, not a promise that it is synchronized with native metadata.
 // No WebGL texture or Unity buffer is modified.
 function observedIdleMarkers(reference){
  const atlas=window.PHMCompositorProbe?.activeSpriteImage?.();
  if(!atlas?.rgba||atlas.width!==576||atlas.height!==928)
   return {available:false,reason:'No observed 576x928 SpriteRenderer atlas currently available'};
  const colors=new Map();let count=0;
  for(let y=64;y<128;y++)for(let x=0;x<64;x++){
   const p=(y*576+x)*4,bytes=atlas.rgba;
   if(bytes[p+3]!==254)continue;
   count++;
   const key=bytes[p]+','+bytes[p+1]+','+bytes[p+2]+',254';
   colors.set(key,(colors.get(key)||0)+1);
  }
  const sampled=[...colors].map(([rgba,pixels])=>({rgba:rgba.split(',').map(Number),pixels}));
  const match=Array.isArray(reference)&&count>0&&sampled.every(({rgba})=>
   rgba[0]===reference[0]&&rgba[1]===reference[1]&&rgba[2]===reference[2]);
  return {available:true,atlasTextureId:atlas.id,atlasHash:atlas.hash,
   alpha254IdleMarkers:count,markerColors:sampled,allObservedMarkersMatchNativeReference:match,
   caveat:'GPU texture upload observation may not be from the same rebuild as the last native status. Rebuild before recording.'};
 }
 function experimentalUnderlayStatus(){
  const m=mod||window.gameInstance?.Module||window.PHMGameInstance?.Module;
  const g=m?.asm?.phm_underlay_status;
  if(!g || typeof g.value!=='number')return {available:false,reason:'Experimental native underlay status export unavailable'};
  const value=g.value|0;
  const descriptions={
   0:'No native builder test completed since initialization',
   1:'Cape: one underlay pixel added',
   2:'Fire Lizard: five underlay pixels replaced',
   3:'Apache Armor: one background pixel erased',
   4:'Alien Armor: four missing pixels added',
   5:'Angel Armor: seven incorrect colors replaced',
   6:'Dracula Armor: sixteen missing cape/armor pixels added',
   7:'Furry Body: three pixels added and one recolored',
   8:'Lizard Body: five colors replaced',
   9:'Merman Body: four missing pixels added',
   10:'Werewolf Body: six missing pixels added',
   11:'Hellsing Helmet: one outline pixel added',
   12:'Snow Rider Helmet: one outline pixel added',
   '-1':'Skipped: unexpected managed array/list identity',
   '-2':'Skipped: firearm alpha does not match any of the 25 known Unity source masks',
   '-3':'Skipped: current first idle does not match known exact or palette-invariant reference structure',
   '-4':'Skipped: required palette source pixel missing',
   '-5':'Skipped: firearm covers a correction coordinate (Bolt only)',
   '-6':'Skipped: all patch pixels are already hidden by this firearm',
   '-7':'Skipped: source-layer alpha at a correction target does not match the known shape'};
  const weaponNames={"0":"Bolt", "1":"2-Shotgun", "2":"6-MachineGun", "3":"6-MiniMachineGun", "4":"AK-47", "5":"AimBolt", "6":"Bazuka", "7":"DLT-19", "8":"E-11", "9":"GoldenEagle", "10":"HKG36", "11":"Launcher", "12":"M-16", "13":"MachineGun", "14":"Pistol", "15":"PowerBazuka", "16":"Revolver", "17":"SAWN-OFF", "18":"SVD", "19":"Shotgun", "20":"Sniper1", "21":"Sniper2", "22":"StelsPistol", "23":"Crossbow"};
  const sourceLayer=value>=8000;
  const swatchAware=value>=5000&&!sourceLayer;
  const decoded=sourceLayer?value-8000:swatchAware?value-5000:value;
  const itemCode=decoded>100?decoded%100:decoded;
  const weaponId=decoded>100?Math.floor(decoded/100):decoded>0?0:null;
  const weaponName=weaponId===null?null:(weaponId===24?'Recognized original firearm':weaponNames[weaponId]||'Known mask');
  const multi=itemCode===99;
  const correctedItem=multi?'Multiple item source layers':descriptions[itemCode]||null;
  const readable=sourceLayer?(multi?'Multiple original item sources patched':(correctedItem||'Original item source patched')):
   decoded>100&&correctedItem?(weaponName+': '+correctedItem):descriptions[value]||'Unknown native underlay code';
  const detail=sourceLayer?'Source-layer match applied — '+readable:swatchAware?('Swatch-aware fallback applied — '+readable):readable;
  return {available:true,status:value,description:detail,firearm:weaponName,correctedItemCode:itemCode>0&&itemCode<=12?itemCode:null,
   matchMode:value>0?(sourceLayer?'source-layer':swatchAware?'swatch-aware':'exact-reference'):null,
   experimental:true,scope:'12 item templates and 25 source firearm masks; v89 four-item unique-donor source fallback remains experimental with added equipment',
   note:'v89 preserves the v88 source-layer matcher and additionally accepts the unique primary native item source alone for Apache, Alien, Dracula, and Furry when optional companion textures are absent only when the previously accepted exact and swatch-aware paths reject a valid firearm state. It reads original swatch-adjusted item arrays and writes within those same arrays at the item layer depth, never the firearm. Codes 8001-8012 represent Bolt source matches; 8099 represents multiple items. Other source-recognized firearms may use a higher code. Unsupported source arrangements still skip. The independent v80 hand-color source108 failure is NOT repaired.'};
 }
 // v87: light, read-only list-provenance snapshot. The previous full-
 // character fingerprint changes when a helmet is equipped, even if the
 // underlying Body/Armor item has not changed. Capturing each native input
 // separately is necessary to identify the original category safely.
 // This reads EXISTING native snapshot buffers; it writes no Unity pixels.
 function underlaySourceLayerSnapshot(){
  const m=mod||window.gameInstance?.Module||window.PHMGameInstance?.Module;
  if(!m?.asm||!setup(m))return {available:false,reason:'Native module unavailable'};
  const a=m.asm,mem=a.Oh||m.wasmMemory||a.memory;
  if(!mem?.buffer)return {available:false,reason:'Unity memory unavailable'};
  const serial=a.phm_v64_snapshot_serial?.value;
  if(!Number.isInteger(serial)||serial<=0)return {available:false,reason:'No complete source-array snapshot yet; change a selection after game loads'};
  const view=new DataView(mem.buffer),rd=i=>view.getUint32(dst+i,true);
  if(dst+FRAME_TOTAL+TRACE_SIZE>mem.buffer.byteLength||rd(0)!==MAGIC||rd(28)!==ARRAY_PIXELS||rd(44)!==64||rd(48)!==64)
   return {available:false,reason:'Native snapshot header missing or unsupported'};
  const count=rd(4),gunSlot=rd(8),present=rd(32);
  if(count<1||count>MAX||rd(40)!==count+1||present!==1||gunSlot>=count)
   return {available:false,reason:'Snapshot is not a supported equipped firearm rebuild'};
  const provenance=dst+FRAME_TOTAL;
  const provCount=view.getUint32(provenance,true),overflow=view.getUint32(provenance+4,true);
  if(provCount>60||view.getUint32(provenance+8,true)!==0x50363956)
   return {available:false,reason:'Append-site provenance unavailable'};
  const ptrs=Array.from({length:count},(_,i)=>view.getUint32(provenance+1536+i*4,true));
  const categories=Array.from({length:count},()=>[]);
  const events=[];
  for(let i=0;i<provCount;i++){
   const p=provenance+16+i*20,tag=view.getUint32(p,true),last=view.getUint32(p+12,true);
   const matchingSlots=last?ptrs.flatMap((q,j)=>q===last?[j]:[]):[];
   events.push({tag,matchingSlots});
   for(const index of matchingSlots)categories[index].push(tag);
  }
  const masks=[];
  for(let i=0;i<count;i++){
   const pixels=new Uint8Array(mem.buffer,dst+HEAD+(i+1)*STRIDE,STRIDE);
   const bits=new Uint8Array(512);let occupied=0;
   for(let k=0;k<F*F;k++)if(pixels[k*4+3]){bits[k>>3]|=1<<(k&7);occupied++;}
   const maskHex=Array.from(bits,b=>b.toString(16).padStart(2,'0')).join('');
   masks.push({slot:i,firearm:i===gunSlot,matchingAppendTags:[...new Set(categories[i])],
    alphaMask64x64Hex:maskHex,opaqueOrTranslucentPixels:occupied,rgbaFnv1a32:hash(pixels),
    sampleCoordsZeroBased:[[27,17],[27,18],[26,19],[27,19],[27,20],[25,19],[28,19]].map(([x,y])=>({xy:[x,y],rgba:readPixel(pixels,x,y)}))});
  }
  if(a.phm_v64_snapshot_serial?.value!==serial)
   return {available:false,reason:'Native rebuild changed during capture; retry'};
  return {available:true,serial,firearmSlot:gunSlot,layerCount:count,
    source:'Existing read-only native first-idle layer snapshot and append-site pointer identities',
    alphaMaskEncoding:'64x64 top-down alpha nonzero; bit k uses byte floor(k/8), bit (k%8), row-major; hexadecimal bytes',
    layers:masks,appendEvents:events,appendTraceOverflow:!!overflow,
    caveat:'Tags are native append sites, NOT proven UI category names. Combine comparative captures to assign category provenance; source-layer matching is not yet a live geometry fix.'};
 }
 // v88: read-only evidence of the actual freshly captured arm sources.
 // This does NOT override the native missing-selected-overlay guard.
 function nativeArmSourceEvidence(){
  const m=mod||window.gameInstance?.Module||window.PHMGameInstance?.Module;
  if(!m?.asm||!setup(m))return {available:false,reason:'Native module unavailable'};
  const mem=m.asm.Oh||m.wasmMemory||m.asm.memory;
  if(!mem?.buffer)return {available:false,reason:'Wasm memory unavailable'};
  const base=dst+FULL_META;
  if(base+128>mem.buffer.byteLength)return {available:false,reason:'Native metadata is out of range'};
  const v=new DataView(mem.buffer),rd=o=>v.getUint32(base+o,true);
  if(rd(0)!==FULL_MAGIC)return {available:false,reason:'No current native rebuild metadata'};
  const fresh104=rd(16)===1,fresh108=rd(20)===1;
  const optional108Absent=v.getUint32(dst+FRAME_TOTAL+1984+20,true)===1;
  const origin=dst+FULL_DATA+ATLAS_BYTES;
  const read=(which)=>{
   const ptr=origin+which*ATLAS_BYTES;
   if(ptr+ATLAS_BYTES>mem.buffer.byteLength)return null;
   const bytes=new Uint8Array(mem.buffer,ptr,ATLAS_BYTES);
   return [[27,19],[28,19],[26,21],[27,20]].map(([x,y])=>({xy:[x,y],rgba:sampleAtlas(bytes,x,y)}));
  };
  return {available:true,source104Fresh:fresh104,source108Fresh:fresh108,
   source108OptionalAbsentProven:optional108Absent,
   source108SelectedButUnavailable:!fresh108&&!optional108Absent,
   source104Samples:fresh104?read(0):null,source108Samples:fresh108?read(1):null,
   caveat:'Observational samples from the most recent native arm source copies only. A missing selected 108 source cannot safely be replaced by guessing skin or armor color. Values must be paired with a fresh rebuilt hand-color status.'};
 }
 function automaticIdleStatus(){
  const m=mod||window.gameInstance?.Module||window.PHMGameInstance?.Module;
  if(!m?.asm||!setup(m))return {available:false,reason:'Unity native idle reference not initialized'};
  const mem=m.asm.Oh||m.wasmMemory||m.asm.memory;
  if(!mem?.buffer)return {available:false,reason:'WebAssembly memory not available'};
  const p=dst+FULL_META;
  if(p+128>mem.buffer.byteLength)return {available:false,reason:'Native metadata out of range'};
  const v=new DataView(mem.buffer),rd=o=>v.getUint32(p+o,true);
  if(rd(0)!==FULL_MAGIC)return {available:false,reason:'No complete Unity rebuild since diagnostic setup'};
  const n=rd(104);
  const selectedReference=n===1||n===4?rgba(rd(112)):null;
  const descriptions={0:'No armed idle result yet',1:'Idle hand markers recolored from current Cape/Back-excluded body/arm reference',2:'Skipped: required source missing or optional-source absence not proven',3:'Skipped: unexpected firearm merge order',4:'Skipped: reference pixel transparent',5:'Skipped: no alpha-254 hand markers',6:'Skipped: markers do not match the source-verified count (7 or 9)'};
  return {available:true,build:'Pixel Hero Maker [v.90]',mode:'native-automatic-idle-only',excludedReferenceCategories:['Back','Cape'],status:n,statusDescription:descriptions[n]||'Unknown status',
   idleFrame:'64x64 tile at Unity atlas x=0,y=64; all other tiles excluded',
   referencePixelOneBased:[28,20],referencePixelZeroBased:[27,19],referenceColor:selectedReference,observedSpriteAtlas:observedIdleMarkers(selectedReference),
   firearmLayerSlot:n===0?null:rd(116),detectedMarkers:rd(108),changedMarkerPixels:rd(120),acceptedMarkerPixels:rd(124),
   freshArm104:rd(16)===1,freshArm108:rd(20)===1,optionalArm108Absent:v.getUint32(dst+FRAME_TOTAL+1984+20,true)===1,reconstructedAtlasStatus:rd(24),reconstructedFirstFrameReference:rgba(rd(48)),
   experimentalUnderlay:experimentalUnderlayStatus(),underlaySourceLayers:underlaySourceLayerSnapshot(),nativeArmSourceEvidence:nativeArmSourceEvidence(),requiresManualUnarmedCapture:false,oldColorGuessingEnabled:false,otherFramesChangedByThisFix:false,
   caveat:'Reports the most recent normal Unity rebuild; native WebGL gameplay and exported SpriteSheet.png still need verification.'};
 }
 function saveAutomaticIdleTrace(){
  const result=automaticIdleStatus();
  deliver(new Blob([JSON.stringify({format:'PixelHero-v90-AutomaticIdleTrace-1',capturedAt:new Date().toISOString(),result},null,2)],{type:'application/json'}),'PixelHero-v90-IdleAutoHandTrace.json');
  status(result.statusDescription||result.reason||'No automatic correction observed');
 }
 function status(msg){for(const id of ['phm-v76-status','phm-v76-auto-result']){const x=$(id);if(x)x.textContent=msg;}}
 function wrap(fn){try{error=null;return fn();}catch(e){error=String(e?.message||e);status('Capture failed: '+error);}}
 function init(){
  $('phm-v76-check-auto')?.addEventListener('click',()=>wrap(()=>{const r=automaticIdleStatus();status((r.statusDescription||r.reason)+'; detected '+(r.detectedMarkers??0)+' idle markers; reference '+JSON.stringify(r.referenceColor||null)+'; underlay: '+(r.experimentalUnderlay?.description||'not available')+'.');}));
  $('phm-v76-download-auto')?.addEventListener('click',()=>wrap(saveAutomaticIdleTrace));
  $('phm-v76-record-unarmed')?.addEventListener('click',()=>wrap(()=>{const r=readSnapshot('unarmed');armed=null;enableDownloads();status('Saved normal UNARMED rebuild #'+r.serial+' ('+r.layerCount+' merge inputs; '+r.nativeBuilderAppendTrace.events.length+' provenance events). Now equip AK-47 WITHOUT changing other selections, then record AK-47.');}));
  $('phm-v76-prepare-shadow')?.addEventListener('click',()=>wrap(prepareShadow));
  $('phm-v76-record-armed')?.addEventListener('click',()=>wrap(()=>{if(!unarmed)throw Error('Record normal unarmed state first');const r=readSnapshot('armed');if(r.serial<=unarmed.report.serial){armed=null;enableDownloads();throw Error('No new AK-47 rebuild since unarmed capture; reselect AK-47 or change Firearm selection and try again');}{const m=mod||window.gameInstance?.Module||window.PHMGameInstance?.Module;const mem=m?.asm?.Oh||m?.wasmMemory||m?.asm?.memory;
  if(mem?.buffer){const v=new DataView(mem.buffer),p=dst+FRAME_TOTAL+1984;v.setUint32(p,0,true);v.setUint32(p+8,0,true);}}
  enableDownloads();status('Saved AK-47 rebuild #'+r.serial+'; sites 104/108: '+r.nativeArmSourceOutputs.map(x=>x.status).join(' / ')+'. Full 576x928 atlas '+r.fullAtlas.statusDescription+'; pixel mismatches: '+r.fullAtlas.nativePixelDifferences+'. Download JSON and full-atlas PNG.');}));
  $('phm-v76-download-json')?.addEventListener('click',()=>wrap(exportJson));
  $('phm-v76-download-full-atlas')?.addEventListener('click',()=>wrap(exportFullAtlas));
  $('phm-v76-download-composite')?.addEventListener('click',()=>wrap(()=>exportPng('comparison')));
  $('phm-v76-download-layers')?.addEventListener('click',()=>wrap(()=>exportPng('layers')));
  $('phm-v76-download-arm-sources')?.addEventListener('click',()=>wrap(()=>exportPng('arm-sources')));
 }
 window.PHMV76LayerProvenance={setModule(m){mod=m;setup(m);},readSnapshot,document:doc,exportJson,exportPng,automaticIdleStatus,experimentalUnderlayStatus,underlaySourceLayerSnapshot,saveAutomaticIdleTrace,report:()=>({autoIdle:automaticIdleStatus(),unarmed:unarmed?.report||null,armed:armed?.report||null,lastError:error})};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
