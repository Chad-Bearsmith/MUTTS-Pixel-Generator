/* Pixel Hero Maker [v.26] — compositor probe 4 with bounded atlas buffer.
 * Read-only WebGL2 observer: does not alter original WebGL parameters, textures,
 * shaders, uniforms, game data, outfit selections or PNG export.
 * Source atlas fingerprints are EXACT matches only: in-game composed/tinted
 * atlases are *not* expected to match an unmodified source Texture2D.
 */
(()=>{
'use strict';
const W=576,H=928,N=W*H*4,MAX_DRAWS=480,MAX_DRAW_GROUPS=512,MAX_SELECTED=12,MAX_CACHED_ATLASES=12,MAX_READBACK_BYTES=16*1024*1024;
const contexts=new WeakMap(),textures=new WeakMap(),programs=new WeakMap();
const texList=[],programList=[],framebuffers=new WeakMap(),exactHashes=new Map();
const recentAtlases=[];let activeSprite=null,activeSpriteTextureId=null;
const spriteDrawTextures=new Map(); // Read-only lifetime SpriteRenderer texture evidence.

// v57: passive first-idle source-upload observations. Each subscriber receives
// an independent 64x64 copy, never Unity's mutable uploaded buffer.
const idleUploadListeners=new Set();
function observeIdleUploads(listener){if(typeof listener!=='function')throw Error('Expected callback');
 idleUploadListeners.add(listener);return ()=>idleUploadListeners.delete(listener);}
function notifyIdleUpload(bytes,t){
 if(!idleUploadListeners.size)return;
 const cell=new Uint8ClampedArray(64*64*4);
 for(let y=0;y<64;y++){
  const src=((H-1-(64+y))*W)*4;
  cell.set(bytes.subarray(src,src+64*4),y*64*4);
 }
 for(const listener of idleUploadListeners){try{listener({textureId:t.id,sequence:stats.atlasUploads,
  uploadedAt:(typeof performance!=='undefined'?performance.now():Date.now()),frame:cell});}
  catch(e){stats.errors++;stats.lastError='idle-source-observer: '+String(e).slice(0,160);}}
}
let internalReadback=false;const readbackHistory=[];
let nextTex=0,nextProg=0,nextFbo=0,manifest=null,manifestError=null;
const stats={uploads:0,atlasUploads:0,atlasExactMatches:0,atlasContentUnmatched:0,
  atlasUnreadable:0,drawsObserved:0,drawsRecorded:0,errors:0,lastError:null};
const capture={active:false,done:false,started:null,ended:null,draws:[],groups:new Map(),
  skips:{},baseline:null};
const FRAME_KEYS=[[10,0],[10,1],[10,2],[10,3],[12,0],[12,1]];
const ARM_MASKS={"10-0":[1120,1121,1124,1125,1181,1182,1183,1184,1185,1186,1187,1188,1189,1245,1246,1247,1248,1249,1250,1251,1252,1253,1312,1313,1316],"10-1":[1124,1125,1126,1127,1128,1182,1183,1184,1185,1186,1187,1188,1189,1190,1191,1192,1246,1247,1248,1249,1250,1251,1252,1253,1254,1255,1256,1316,1317,1318,1319],"10-2":[1120,1121,1124,1125,1126,1127,1128,1129,1181,1182,1183,1184,1185,1186,1187,1188,1189,1190,1191,1192,1193,1245,1246,1247,1248,1249,1250,1251,1252,1253,1254,1255,1256,1257,1312,1313,1316,1317,1318,1319,1320],"10-3":[1120,1121,1124,1125,1126,1127,1128,1129,1181,1182,1183,1184,1185,1186,1187,1188,1189,1190,1191,1192,1193,1245,1246,1247,1248,1249,1250,1251,1252,1253,1254,1255,1256,1257,1312,1313,1316,1317,1318,1319,1320],"12-0":[1115,1116,1117,1178,1179,1180,1181,1188,1242,1243,1244,1245,1252,1253,1306,1307,1308,1309,1316,1317,1371,1380],"12-1":[1179,1180,1181,1242,1243,1244,1245,1252,1306,1307,1308,1309,1316,1317,1370,1371,1372,1373,1380,1381,1435,1444]};
function skip(key){capture.skips[key]=(capture.skips[key]||0)+1;}
function guarded(fn,otherwise){try{return fn();}catch(e){stats.errors++;stats.lastError=String(e).slice(0,200);return otherwise;}}
function state(gl){let x=contexts.get(gl);if(!x){x={unit:0,bound:new Map(),program:null,fbo:null};contexts.set(gl,x);}return x;}
function texture(obj){if(!obj)return null;let x=textures.get(obj);
 if(!x){x={id:++nextTex,object:obj,gl:null,atlas:null,probe:null,info:{target:null,width:null,height:null,level:0,source:'unknown',updates:0}};textures.set(obj,x);texList.push(x);}return x;}
function program(obj){if(!obj)return null;let x=programs.get(obj);
 if(!x){x={id:++nextProg,object:obj,uniforms:null,kind:'unknown'};programs.set(obj,x);programList.push(x);}return x;}
function fbo(obj){if(!obj)return null;let x=framebuffers.get(obj);if(!x){x=++nextFbo;framebuffers.set(obj,x);}return x;}
// Same signature as the v23 static manifest generator, but NOT used as a
// fuzzy classifier. Modified/composited atlases produce different hashes.
function signature(bytes){let hash=2166136261>>>0;
 const stride=Math.max(4,(Math.floor((bytes.length-4)/1024/4)*4));
 for(let i=0;i<bytes.length-3;i+=stride)
  for(let k=0;k<4;k++)hash=Math.imul(hash^bytes[i+k],16777619)>>>0;
 hash=Math.imul(hash^bytes.length,16777619)>>>0;
 return hash.toString(16).padStart(8,'0');
}
function atlasBytes(gl,args,sub){
 // These are the only RGBA8 full-size upload overloads we can safely inspect.
 const w=args[sub?4:3],h=args[sub?5:4];
 if(args[0]!==gl.TEXTURE_2D||args[1]!==0||w!==W||h!==H)return null;
 if(args[6]!==gl.RGBA||args[7]!==gl.UNSIGNED_BYTE)return null;
 const raw=args[8],start=args.length>9?args[9]:0;
 if(!ArrayBuffer.isView(raw)||raw.BYTES_PER_ELEMENT!==1||!Number.isInteger(start)||
   start<0||start+N>raw.byteLength)return null;
 return new Uint8Array(raw.buffer,raw.byteOffset+start,N);
}
function rgbaAt(bytes,x,y,flip){
 const pos=((flip?H-1-y:y)*W+x)*4;
 return [bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]];
}
function colorHex(c){return c.map(x=>x.toString(16).padStart(2,'0')).join('');}
function armData(bytes,flip){
 const rows=[];
 for(const [row,col] of FRAME_KEYS){
  const key=row+'-'+col,mask=ARM_MASKS[key],counts={empty:0,opaque:0,partial:0};
  const colors=new Map(),maskHex=[];
  for(const cellPixel of mask){
   const x=col*64+cellPixel%64,y=row*64+(cellPixel/64|0),rgba=rgbaAt(bytes,x,y,flip);
   maskHex.push(colorHex(rgba));
   if(!rgba[3])counts.empty++;else if(rgba[3]>=245)counts.opaque++;else counts.partial++;
   const c=colorHex(rgba);colors.set(c,(colors.get(c)||0)+1);
  }
  // Surrounding sleeve/hand landmarks in each problem pose, outside the
  // original six-frame restoration mask. No outfit color is assumed.
  const near=[];
  for(const y of [14,17,20,23,26,30])for(const x of [24,28,32,36,40,44])
    near.push(colorHex(rgbaAt(bytes,col*64+x,row*64+y,flip)));
  rows.push({cell:key,maskPixels:mask.length,counts,
    commonRGBA:[...colors].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([rgba,count])=>({rgba,count})),
    maskRGBAHex:maskHex.join(''),nearbyGridRGBAHex:near.join(''),
    nearbyGridOrder:'y=[14,17,20,23,26,30]; x=[24,28,32,36,40,44]'});
 }
 return rows;
}
function paletteProbes(bytes,flip){
 const locs=[];
 // Swatches are evidence only. The same screen pixel is not necessarily an
 // active skin/armor shade across different outfits or selected animations.
 for(const row of [1,3,8,10,12])for(const [x,y] of [[29,17],[29,20],[30,20],[33,18],[36,20],[39,21]]){
  locs.push({row,col:0,x,y,rgba:colorHex(rgbaAt(bytes,x,row*64+y,flip))});
 }
 return locs;
}
function probeAtlas(bytes){
 let marked=0,nonzero=0;
 // Sparse, explicitly labelled survey. Full upload copies remain untouched.
 for(let i=0;i<N;i+=64){const a=bytes[i+3];if(a)nonzero++;if(a>=252&&a<=254)marked++;}
 return {sampleStridePixels:16,sampledNonTransparent:nonzero,
  sampledAlpha252to254:marked,topDown:{armFrames:armData(bytes,false),palette:paletteProbes(bytes,false)},
  bottomUp:{armFrames:armData(bytes,true),palette:paletteProbes(bytes,true)}};
}
function upload(gl,args,sub){
 const w=args[sub?4:3],h=args[sub?5:4];
 stats.uploads++;
 if(args[0]!==gl.TEXTURE_2D||args[1]!==0||w!==W||h!==H)return;
 stats.atlasUploads++;
 const s=state(gl),t=texture(s.bound.get(s.unit));if(!t){stats.atlasUnreadable++;return;}
 const bytes=atlasBytes(gl,args,sub);if(!bytes){stats.atlasUnreadable++;return;}
 const hash=signature(bytes),matched=(exactHashes.get(hash)||[]).slice(0,8);
 t.atlas={hash,exactSourceMatches:matched,
  contentClass:matched.length?'exact-source-content':'unmatched-content-possibly-composited-or-recolored',
  byteLength:N,sequence:stats.atlasUploads};
 if(matched.length)stats.atlasExactMatches++;else stats.atlasContentUnmatched++;
 // Keep small, bounded arm/swatches probes per atlas, not 2MB copies of each.
 t.probe=probeAtlas(bytes);
 // Keep no more than twelve exact final GPU-upload buffers (about 24.5 MiB).
 // This is needed to take an actual outfit reference without modifying Unity.
 const prior=recentAtlases.indexOf(t);if(prior>=0)recentAtlases.splice(prior,1);
 t.pixels=new Uint8Array(bytes);recentAtlases.push(t);
 while(recentAtlases.length>MAX_CACHED_ATLASES){const stale=recentAtlases.shift();stale.pixels=null;}
 notifyIdleUpload(bytes,t);
}
function inspectSize(source){
 if(!source)return null;
 const w=Number(source.videoWidth||source.naturalWidth||source.width),h=Number(source.videoHeight||source.naturalHeight||source.height);
 return Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0?{width:w,height:h}:null;
}
function noteImage(gl,args,kind){
 const s=state(gl),t=texture(s.bound.get(s.unit));if(!t)return;
 t.gl=gl;
 const isUpload=kind==='texImage2D'||kind==='texSubImage2D';
 const isSub=kind==='texSubImage2D'||kind==='copyTexSubImage2D'||kind==='compressedTexSubImage2D';
 let w=null,h=null,level=args[1];
 if(kind==='texStorage2D'){w=args[3];h=args[4];level=0;}
 else if(kind==='copyTexImage2D'){w=args[5];h=args[6];}
 else if(kind==='copyTexSubImage2D'){w=args[6];h=args[7];}
 else if(kind==='compressedTexImage2D'){w=args[3];h=args[4];}
 else if(kind==='compressedTexSubImage2D'){w=args[4];h=args[5];}
 else if(isUpload){
  if(args.length>=(isSub?9:9)){w=args[isSub?4:3];h=args[isSub?5:4];}
  else {const z=inspectSize(args[args.length-1]);if(z){w=z.width;h=z.height;}}
 }
 const inf=t.info;inf.target=args[0];inf.source=kind;inf.updates++;
 if(Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&level===0){
  if(!isSub||!Number.isInteger(inf.width)||!Number.isInteger(inf.height)){
   inf.width=w;inf.height=h;
  }
 }
}
// Opt-in GPU readback. Unlike the always-on observer, this temporarily binds a
// private READ framebuffer. ALL changed context state is restored synchronously.
// No live game pixels, texture parameters, draw framebuffer or active shader are modified.
function readbackTexture(id){
 const t=texList.find(t=>t.id===id);if(!t?.object||!t.gl)
  return {ok:false,id,reason:'Texture object/context not observed'};
 const gl=t.gl,inf=t.info||{},w=inf.width,h=inf.height;
 if(inf.target!==gl.TEXTURE_2D||!Number.isInteger(w)||!Number.isInteger(h)||
    w<1||h<1||w*h*4>MAX_READBACK_BYTES)return {ok:false,id,reason:'Texture target or dimensions unavailable/unsafe',info:{...inf}};
 const p=()=>gl.getParameter;
 const params=[['read',gl.READ_FRAMEBUFFER_BINDING],['draw',gl.DRAW_FRAMEBUFFER_BINDING],
 ['packBuf',gl.PIXEL_PACK_BUFFER_BINDING],['packAlign',gl.PACK_ALIGNMENT],
 ['packRow',gl.PACK_ROW_LENGTH],['packSkipPixels',gl.PACK_SKIP_PIXELS],['packSkipRows',gl.PACK_SKIP_ROWS]];
 const old={};let fb=null;let outcome;
 try{
  for(const [k,enumName] of params)old[k]=gl.getParameter(enumName);
  internalReadback=true;
  fb=gl.createFramebuffer();if(!fb)throw Error('Framebuffer allocation failed');
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,fb);
  gl.framebufferTexture2D(gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.object,0);
  if(gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)
   throw Error('Texture is not framebuffer readable (format, completeness or attachment)');
  gl.readBuffer(gl.COLOR_ATTACHMENT0);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
  gl.pixelStorei(gl.PACK_ALIGNMENT,4);gl.pixelStorei(gl.PACK_ROW_LENGTH,0);
  gl.pixelStorei(gl.PACK_SKIP_PIXELS,0);gl.pixelStorei(gl.PACK_SKIP_ROWS,0);
  const raw=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,raw);
  const e=gl.getError();if(e!==gl.NO_ERROR)throw Error('WebGL readPixels error '+e);
  const rgba=new Uint8Array(raw.length),line=w*4;
  for(let y=0;y<h;y++)rgba.set(raw.subarray((h-y-1)*line,(h-y)*line),y*line);
  outcome={ok:true,id,width:w,height:h,rgba,source:'GPU-readPixels-bottom-up-flipped',info:{...inf}};
 }catch(e){outcome={ok:false,id,reason:String(e).slice(0,230),info:{...inf}};}
 finally{
  try{
   if(old.packBuf!==undefined)gl.bindBuffer(gl.PIXEL_PACK_BUFFER,old.packBuf);
   if(old.packAlign!==undefined)gl.pixelStorei(gl.PACK_ALIGNMENT,old.packAlign);
   if(old.packRow!==undefined)gl.pixelStorei(gl.PACK_ROW_LENGTH,old.packRow);
   if(old.packSkipPixels!==undefined)gl.pixelStorei(gl.PACK_SKIP_PIXELS,old.packSkipPixels);
   if(old.packSkipRows!==undefined)gl.pixelStorei(gl.PACK_SKIP_ROWS,old.packSkipRows);
   if(old.read!==undefined)gl.bindFramebuffer(gl.READ_FRAMEBUFFER,old.read);
   if(old.draw!==undefined)gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,old.draw);
   if(fb)gl.deleteFramebuffer(fb);
  }catch(e){outcome={ok:false,id,reason:'Failed to restore WebGL readback state: '+String(e)};}
  internalReadback=false;
 }
 readbackHistory.push({id,ok:outcome.ok,reason:outcome.reason||null,info:{...inf},width:outcome.width||null,height:outcome.height||null});
 if(readbackHistory.length>16)readbackHistory.shift();
 return outcome;
}
function spriteDrawTextureIds(){return [...spriteDrawTextures.values()].sort((a,b)=>b.lastAt-a.lastAt)
 .slice(0,64).map(r=>({id:r.id,count:r.count,lastAt:r.lastAt}));}
function hasSpriteDrawTexture(id){return spriteDrawTextures.has(id);}
function secondarySpriteIds(){
 const groups=[...capture.groups.values()].filter(g=>g.programKind==='unity-sprite');
 const nums=new Map();
 for(const g of groups)for(const t of g.textures)if(t.unit===0)nums.set(t.id,(nums.get(t.id)||0)+g.drawCalls);
 return [...nums].sort((a,b)=>b[1]-a[1]).map(([id,draws])=>({id,draws,
  info:texList.find(t=>t.id===id)?.info||null,
  cachedAtlas:!!texList.find(t=>t.id===id)?.pixels}));
}
// A secondary layer is only evidence-backed when a DIFFERENT texture was
// observed on texture unit zero in an actual Unity SpriteRenderer draw.
// Never reinterpret the primary cached atlas as a secondary texture.
function distinctSecondarySpriteIds(){
 const primary=activeSpriteTextureId;
 return secondarySpriteIds().filter(t=>t.id!==primary);
}
function spriteLayerAssessment(){
 const observed=secondarySpriteIds(),distinct=distinctSecondarySpriteIds();
 return {primaryTextureId:activeSpriteTextureId,
  observedSpriteTextureCount:observed.length,
  distinctSecondaryCount:distinct.length,
  secondaryObserved:distinct.length>0,
  note:distinct.length?'Additional SpriteRenderer texture IDs observed; content/role still unverified.':
   'No distinct secondary SpriteRenderer texture observed in the captured draw groups. This does not prove none exists outside the capture.'};
}
function uniformNames(gl,p){
 const a=program(p);if(!a)return null;
 if(a.uniforms!==null)return a;
 const count=guarded(()=>gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS),0);
 a.uniforms=[];
 for(let i=0;i<Math.min(96,count||0);i++){
  const u=guarded(()=>gl.getActiveUniform(p,i),null);
  if(u)a.uniforms.push({name:u.name,type:u.type,size:u.size});
 }
 const names=new Set(a.uniforms.map(u=>u.name));
 a.kind=names.has('_Flip')&&names.has('_RendererColor')?'unity-sprite':
   names.has('_ClipRect')?'unity-ui':'other';
 return a;
}
function clean(v){
 if(v==null||typeof v==='boolean'||typeof v==='string'||typeof v==='number')return v;
 if(ArrayBuffer.isView(v))return Array.from(v.subarray(0,Math.min(16,v.length))).map(x=>Number.isFinite(x)?x:null);
 if(Array.isArray(v))return v.slice(0,16).map(clean);
 return String(v).slice(0,120);
}
function readUniformValues(gl,p,entries){
 if(!p||!entries)return [];
 return entries.slice(0,35).map(u=>{
  const loc=guarded(()=>gl.getUniformLocation(p,u.name),null);
  return loc===null?null:{name:u.name,value:guarded(()=>clean(gl.getUniform(p,loc)),null)};
 }).filter(Boolean);
}
function draw(gl,method,args){
 // Track the actual SpriteRenderer texture even outside the short diagnostic.
 const s=state(gl),p=uniformNames(gl,s.program);
 if(p?.kind==='unity-sprite'){
  const current=texture(s.bound.get(0));
  if(current){const observed=spriteDrawTextures.get(current.id)||{id:current.id,count:0,lastAt:0};
   observed.count++;observed.lastAt=(typeof performance!=='undefined'?performance.now():Date.now());
   spriteDrawTextures.set(current.id,observed);}
  if(current?.atlas){activeSprite=current;activeSpriteTextureId=current.id;}
 }
 if(!capture.active)return;
 stats.drawsObserved++;
 const bound=[];
 for(const [unit,obj] of s.bound){
  if(unit<0||unit>31||!obj)continue;
  const t=texture(obj);bound.push({unit,id:t.id,
   ...(t.atlas?{atlasHash:t.atlas.hash,contentClass:t.atlas.contentClass}:{} )});
 }
 bound.sort((a,b)=>a.unit-b.unit);
 const label=[p?.id||0,method,args[0],bound.map(t=>t.unit+':'+t.id).join(','),fbo(s.fbo)||0].join('|');
 let g=capture.groups.get(label);
 if(!g){
  if(capture.groups.size>=MAX_DRAW_GROUPS){skip('draw-group-cap');return;}
  g={program:p?.id||null,programKind:p?.kind||'unknown',method,mode:args[0],
   framebuffer:fbo(s.fbo),textures:bound,drawCalls:0,totalIndicesOrVertices:0,
   representativeUniforms:readUniformValues(gl,s.program,p?.uniforms||[])};
  capture.groups.set(label,g);
 }
 g.drawCalls++;g.totalIndicesOrVertices+=Number(args[1])||0;
 const n=stats.drawsObserved;
 const shouldRecord=capture.draws.length<MAX_DRAWS || p?.kind==='unity-sprite';
 if(shouldRecord){
  const item={ordinal:n,kind:method,mode:args[0],count:args[1],program:p?.id||null,
   programKind:p?.kind||'unknown',framebuffer:fbo(s.fbo),textures:bound};
  if(p?.kind==='unity-sprite')item.uniforms=readUniformValues(gl,s.program,p?.uniforms||[]);
  if(capture.draws.length<MAX_DRAWS)capture.draws.push(item);
  else{
   // Reservoir replacement retains later samples instead of only early UI draws.
   const slot=(Math.imul(n,1103515245)+12345>>>0)%n;
   if(slot<MAX_DRAWS)capture.draws[slot]=item;
  }
  stats.drawsRecorded=capture.draws.length;
 }
}
function install(proto){
 if(!proto||proto.__phmCompositorProbeInstalled)return;
 function wrap(name,after){const original=proto[name];if(typeof original!=='function')return;
  proto[name]=function(...args){const result=original.apply(this,args);
   guarded(()=>after(this,args,result));return result;};
 }
 wrap('activeTexture',(gl,a)=>{state(gl).unit=a[0]-gl.TEXTURE0;});
 wrap('createTexture',(gl,a,out)=>texture(out));
 wrap('bindTexture',(gl,a)=>{if(a[0]===gl.TEXTURE_2D){state(gl).bound.set(state(gl).unit,a[1]);const t=texture(a[1]);if(t){t.gl=gl;t.info.target=a[0];}}});
 wrap('texImage2D',(gl,a)=>{
  if(a[1]===0 && (a[3]!==W||a[4]!==H)){
   const t=texture(state(gl).bound.get(state(gl).unit));if(t)t.pixels=null;
  }
  noteImage(gl,a,'texImage2D');upload(gl,a,false);
 });
 wrap('texSubImage2D',(gl,a)=>{
  // A partial base-level mutation invalidates any previously buffered image.
  if(a[1]===0 && (a[2]!==0||a[3]!==0||a[4]!==W||a[5]!==H)){
   const t=texture(state(gl).bound.get(state(gl).unit));if(t)t.pixels=null;
  }
  noteImage(gl,a,'texSubImage2D');upload(gl,a,true);
 });
 for(const name of ['texStorage2D','copyTexImage2D','copyTexSubImage2D','compressedTexImage2D','compressedTexSubImage2D'])
  wrap(name,(gl,a)=>noteImage(gl,a,name));
 wrap('framebufferTexture2D',(gl,a)=>{const t=texture(a[3]);if(t){t.gl=gl;t.info.framebufferAttachment=a[1];}});
 wrap('deleteTexture',(gl,a)=>{
  const t=textures.get(a[0]);if(!t)return;
  t.pixels=null;const i=recentAtlases.indexOf(t);if(i>=0)recentAtlases.splice(i,1);
  if(activeSprite===t){activeSprite=null;activeSpriteTextureId=null;}t.object=null;t.gl=null;
 });
 wrap('useProgram',(gl,a)=>{state(gl).program=a[0];program(a[0]);});
 wrap('bindFramebuffer',(gl,a)=>{if(a[0]===gl.FRAMEBUFFER||a[0]===gl.DRAW_FRAMEBUFFER)state(gl).fbo=a[1];});
 for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'])
  wrap(name,(gl,a)=>draw(gl,name,a));
 Object.defineProperty(proto,'__phmCompositorProbeInstalled',{value:true});
}
function activeSpriteImage(){
 const t=activeSprite;
 if(!t?.pixels||t.pixels.length!==N)return null;
 // WebGL upload rows are bottom-up for this game (confirmed by the v24
 // 182-position silhouette sample). Preview/export uses top-down PNG rows.
 const rgba=new Uint8Array(N),rowBytes=W*4;
 for(let y=0;y<H;y++)rgba.set(t.pixels.subarray((H-1-y)*rowBytes,(H-y)*rowBytes),y*rowBytes);
 return {id:t.id,hash:t.atlas?.hash||null,rgba,width:W,height:H,
  orientation:'top-down-from-WebGL-bottom-up'};
}
function report(){
 const groups=[...capture.groups.values()].sort((a,b)=>b.drawCalls-a.drawCalls);
 const usedIds=new Map();
 for(const g of groups)for(const t of g.textures){const n=usedIds.get(t.id)||{id:t.id,
   draws:0,programKinds:new Set()};n.draws+=g.drawCalls;n.programKinds.add(g.programKind);usedIds.set(t.id,n);}
 const selected=[...usedIds.values()].filter(x=>x.programKinds.has('unity-sprite'))
  .sort((a,b)=>b.draws-a.draws).slice(0,MAX_SELECTED);
 const index=new Map(texList.map(t=>[t.id,t]));
 const chosen=selected.map(x=>{const t=index.get(x.id);
  return {id:x.id,spriteDraws:x.draws,...(t?.atlas||{contentClass:'no-full-rgba-atlas-upload-seen'}),
   interpretation:'Both orientations are reported; select using independent pixel/frame evidence, not guessed colors.',
   probes:t?.probe||null,textureInfo:t?.info||null};});
 return {version:'v45-native-scene-probe',purpose:'Read-only renderer diagnostic; optional user-initiated outfit-reference capture is separate',
  manifestEntries:manifest?.entries?.length||0,manifestError,
  spriteTextureCandidates:secondarySpriteIds(),spriteDrawTextureIds:spriteDrawTextureIds(),spriteLayerAssessment:spriteLayerAssessment(),distinctSecondarySpriteCandidates:distinctSecondarySpriteIds(),readbackAttempts:readbackHistory.slice(),
  activeSpriteAtlas:{id:activeSpriteTextureId,fullBufferAvailable:!!activeSprite?.pixels,
   hash:activeSprite?.atlas?.hash||null,cacheCount:recentAtlases.filter(t=>!!t.pixels).length},
  summary:{...stats,uniqueTextures:texList.length,uniquePrograms:nextProg,
   capturedIntervalUploads:stats.uploads-(capture.baseline?.uploads||0),
   capturedIntervalAtlasUploads:stats.atlasUploads-(capture.baseline?.atlasUploads||0),
   capturedIntervalDraws:stats.drawsObserved-(capture.baseline?.drawsObserved||0)},
  programs:programList.map(p=>({id:p.id,kind:p.kind,uniforms:p.uniforms})),
  sampledAtlasTextures:chosen,
  atlasCatalog:texList.filter(t=>t.atlas).map(t=>({id:t.id,...t.atlas})),
  capture:{started:capture.started,ended:capture.ended,skips:capture.skips,
   drawGroups:groups,draws:[...capture.draws].sort((a,b)=>a.ordinal-b.ordinal)}};
}
function save(obj,filename){
 const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function message(text){const el=document.getElementById('phm-probe-status');if(el)el.textContent=text;}
function begin(){
 if(capture.active)return;
 capture.active=true;capture.done=false;capture.started=new Date().toISOString();capture.ended=null;
 capture.draws=[];capture.groups=new Map();capture.skips={};capture.baseline={...stats};
 const btn=document.getElementById('phm-compositor-probe');if(btn)btn.disabled=true;
 message('Capturing read-only draw groups for 2 seconds…');
 setTimeout(()=>{
  capture.active=false;capture.done=true;capture.ended=new Date().toISOString();
  if(btn)btn.disabled=false;
  const r=report();
  if(r.summary.capturedIntervalDraws){
   save(r,'PixelHero-v58-RendererTrace.json');
   message('Saved '+r.summary.capturedIntervalDraws+' draws, '+r.capture.drawGroups.length+
    ' draw groups, '+r.sampledAtlasTextures.length+' sprite-atlas samples. No texture modifications by the probe.');
  }else message('No WebGL draw calls captured. Load and display the character before retrying.');
 },2000);
}
function init(){const btn=document.getElementById('phm-compositor-probe');
 if(btn)btn.addEventListener('click',begin);
 message('Compositor probe 5 ready; capture the armed avatar to check drawn sprite textures.');
}
window.PHMCompositorProbe={begin,report,signature,stats,activeSpriteImage,secondarySpriteIds,distinctSecondarySpriteIds,spriteLayerAssessment,readbackTexture,observeIdleUploads,spriteDrawTextureIds,hasSpriteDrawTexture,activeSpriteTextureId:()=>activeSpriteTextureId};
const proto=typeof WebGL2RenderingContext==='undefined'?null:WebGL2RenderingContext.prototype;
if(proto)guarded(()=>install(proto));else manifestError='WebGL2 unavailable';
if(typeof fetch==='function')fetch('phm-probe-manifest.json').then(r=>{
 if(!r.ok)throw Error('manifest HTTP '+r.status);return r.json();
}).then(j=>{manifest=j;
 for(const e of j.entries){for(const [hash,orientation] of [[e.fingerprint,'source-original'],[e.flippedFingerprint,'source-flipped']]){
  const list=exactHashes.get(hash)||[];list.push({name:e.name,source:e.source,pid:e.pid,orientation});exactHashes.set(hash,list);
 }}
}).catch(e=>{manifestError=String(e).slice(0,200);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
