/* Pixel Hero Maker [v.89] — static idle presentation, direct native atlas.
 * Scene level0 draws the ORIGINAL Unity preview with both body/weapon Animator
 * components disabled and exposes its existing native Save button as "Export".
 * Unity's native controls, not an HTML overlay, are visible inside the canvas.
 * This bridge reads the 64x64 first-idle cell (x=0,y=64), encodes 20x exact
 * nearest-neighbor RGBA, and handles click/download within the Unity canvas.
 * It never modifies the compiled Unity WASM or supplies animated frames.
 */
(()=>{'use strict';
const CELL=64,SCALE=20,SIZE=CELL*SCALE;
const stats={version:'v.89',mode:'native-single-idle',sourceCell:[0,1],
  originalPixelSize:[64,64],outputScale:20,outputPaddingPixels:0,outputPixelSize:null,
  ready:false,previewUpdates:0,exported:0,interceptedNativeDownloads:0,
  nativeButtonClicks:0,lastTextureId:null,lastTextureHash:null,lastError:null};
let current=null,lastHash=null,lastReport=null,busy=false;
function extractFirstIdle(rgba,width=576,height=928){
 if(!(rgba instanceof Uint8Array||rgba instanceof Uint8ClampedArray)||width<CELL||height<CELL*2||rgba.length<width*height*4)
  throw Error('The active character atlas is unavailable or has an unexpected size');
 const result=new Uint8ClampedArray(CELL*CELL*4);
 for(let y=0;y<CELL;y++){const s=(64+y)*width*4;result.set(rgba.subarray(s,s+CELL*4),y*CELL*4);}
 return result;
}
function scale20(frame){
 if(!frame||frame.length!==CELL*CELL*4)throw Error('Expected 64×64 RGBA idle frame');
 const dest=new Uint8ClampedArray(SIZE*SIZE*4);
 for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++){
  const s=(y*CELL+x)*4;
  for(let yy=0;yy<SCALE;yy++)for(let xx=0;xx<SCALE;xx++){
   const d=((y*SCALE+yy)*SIZE+x*SCALE+xx)*4;
   dest[d]=frame[s];dest[d+1]=frame[s+1];dest[d+2]=frame[s+2];dest[d+3]=frame[s+3];
  }
 }
 return dest;
}
/* Extract the smallest alpha-visible bounding rectangle, centered in a
 * square whose side length is max(width,height). Only the shorter dimension
 * receives transparent pixels (if any), with any odd extra on right/bottom.
 * This includes all equipped items, capes, tails, and weapon muzzle pixels.
 * No fixed outside margin is added. Empty images retain a 64x64 square. */
function cropIdle(frame){
 if(!frame||frame.length!==CELL*CELL*4)throw Error('Expected a 64×64 RGBA idle frame');
 let x0=CELL,y0=CELL,x1=-1,y1=-1;
 for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++)if(frame[(y*CELL+x)*4+3]>0){
  x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
 }
 if(x1<0)return {pixels:new Uint8ClampedArray(frame),width:CELL,height:CELL,bounds:null,padding:0,offset:[0,0]};
 const w=x1-x0+1,h=y1-y0+1,side=Math.max(w,h);
 const left=Math.floor((side-w)/2),top=Math.floor((side-h)/2);
 const pixels=new Uint8ClampedArray(side*side*4);
 for(let y=0;y<h;y++){
  const from=((y+y0)*CELL+x0)*4,to=((y+top)*side+left)*4;
  pixels.set(frame.subarray(from,from+w*4),to);
 }
 return {pixels,width:side,height:side,bounds:[x0,y0,x1+1,y1+1],padding:0,offset:[left,top]};
}
function paintNativePreview(frame){
 // The overlay lives INSIDE #unity-container, in the exact area of the
 // original preview SpriteRenderer. It is not an external browser editor.
 const preview=document.getElementById('phm-native-preview-surface');
 if(!preview)return false;
 const ctx=preview.getContext('2d',{alpha:true});if(!ctx)return false;
 ctx.clearRect(0,0,CELL,CELL);
 ctx.putImageData(new ImageData(frame,CELL,CELL),0,0);
 return true;
}
function refresh(){
 const atlas=window.PHMCompositorProbe?.activeSpriteImage?.();
 if(!atlas||atlas.width!==576||atlas.height!==928||!atlas.rgba)return false;
 // The full-atlas 1024-sample hash is diagnostic only. Gun swatches can
 // recolor pixels WITHOUT changing that hash or the GPU texture identity.
 // Always compare the complete 64x64 idle frame before exporting.
 const sourceFrame=extractFirstIdle(atlas.rgba,atlas.width,atlas.height);
 // Since v78: direct, Unity-produced atlas pixels (native hand markers may be recolored). No legacy JS geometry
 // restoration, color inference, overlay reconstruction or fallback.
 const frame=sourceFrame;
 if(!current||!frame.every((v,i)=>v===current[i])){
  current=frame;
  paintNativePreview(frame);
  stats.previewUpdates++;
 }
 lastHash=atlas.hash;lastReport=atlas.id;
 stats.ready=true;stats.lastTextureId=atlas.id;stats.lastTextureHash=atlas.hash;
 return true;
}
function imageURL(){
 refresh();
 if(!current)throw Error('Idle sprite not available. Choose a character or change an item first.');
 // Browser PNG encoder, but the UI control is an actual Unity Button.
 const cropped=cropIdle(current);
 const src=document.createElement('canvas');src.width=cropped.width;src.height=cropped.height;
 const s=src.getContext('2d',{alpha:true});if(!s)throw Error('2D image canvas unavailable');
 s.putImageData(new ImageData(cropped.pixels,cropped.width,cropped.height),0,0);
 const output=document.createElement('canvas');output.width=cropped.width*SCALE;output.height=cropped.height*SCALE;
 stats.outputPixelSize=[output.width,output.height];stats.lastCropBounds=cropped.bounds;stats.lastSquareOffset=cropped.offset;
 const ctx=output.getContext('2d',{alpha:true});if(!ctx)throw Error('PNG output canvas unavailable');
 ctx.imageSmoothingEnabled=false;
 ctx.clearRect(0,0,output.width,output.height);
 ctx.drawImage(src,0,0,output.width,output.height);
 return output.toDataURL('image/png');
}
const originalAnchorClick=HTMLAnchorElement.prototype.click;
let internalDownload=false;
HTMLAnchorElement.prototype.click=function(...args){
 const name=String(this.download||this.getAttribute('download')||'');
 // Limit the compatibility interceptor to known native export basenames.
 // Other PNGs (including firearm-free diagnostic frames) must pass unchanged.
 if(!internalDownload&&/^(?:PixelHero-Idle-20x|SpriteSheet)\.png$/i.test(name)){ 
  try{
   const url=imageURL();
   this.href=url;this.download=(name==='PixelHero-Idle-20x.png'?'SpriteSheet.png':name);
   stats.interceptedNativeDownloads++;stats.exported++;
  }catch(e){stats.lastError=String(e);console.warn('Native export conversion failed; preserving original save:',e);}
 }
 return originalAnchorClick.apply(this,args);
};
function exportIdle(){
 if(busy)return false;busy=true;
 try{
  const data=imageURL();const a=document.createElement('a');
  a.href=data;a.download='SpriteSheet.png';
  internalDownload=true;
  try{document.body.appendChild(a);originalAnchorClick.call(a);a.remove();}
  finally{internalDownload=false;}
  stats.exported++;return true;
 }catch(e){stats.lastError=String(e);console.error('Unity native Export button:',e);
  if(typeof window.alert==='function')window.alert('Export failed: '+e.message);
  return false;
 }finally{busy=false;}
}
function isNativeExportPosition(event,canvas){
 const box=canvas.getBoundingClientRect();
 if(!box.width||!box.height)return false;
 // Built-in Save RectTransform: on the original preview Panel, bottom center.
 // Broad region absorbs Unity's canvas rescaling but never overlaps item controls.
 const x=(event.clientX-box.left)*960/box.width;
 const y=(event.clientY-box.top)*600/box.height;
 return x>=117&&x<=346&&y>=480&&y<=555;
}
function setupNativeExportHitbox(){
 const canvas=document.getElementById('unity-canvas');if(!canvas)return;
 for(const eventType of ['pointerdown','pointerup','click']){
  canvas.addEventListener(eventType,e=>{
   if(!isNativeExportPosition(e,canvas))return;
   // Prevent the original Unity Save() callback, which exports a full sheet.
   // Use the existing native Unity button as the visible UI control instead.
   e.preventDefault();e.stopImmediatePropagation();
   if(eventType==='pointerup'){stats.nativeButtonClicks++;exportIdle();}
  },true);
 }
 canvas.addEventListener('pointerup',()=>{setTimeout(refresh,100);setTimeout(refresh,450);},{passive:true});
}
// Do not pass animation hotkeys to Unity. Body/item selection remains clickable.
document.addEventListener('keydown',ev=>{
 const active=document.activeElement;
 if(active&&/^(input|textarea|select)$/i.test(active.tagName))return;
 if(!active||active===document.body||active.id==='unity-canvas'){
  if(ev.ctrlKey||ev.metaKey||ev.altKey||ev.key==='Tab'||ev.key==='Escape')return;
  ev.preventDefault();ev.stopImmediatePropagation();
 }
},true);
function init(){setupNativeExportHitbox();setInterval(refresh,220);}
window.PHMIdleFrame={extractFirstIdle,scale20,cropIdle,refresh,exportIdle,
 report:()=>({...stats}),onUnityReady:()=>{setTimeout(refresh,100);setTimeout(refresh,800);}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
