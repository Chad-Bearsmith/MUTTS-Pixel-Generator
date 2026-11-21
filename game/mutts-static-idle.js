/* Export Unity's combined first-idle sprite at 20× nearest-neighbor scale
 * through the existing Unity Save button labeled "Export".
 */
(()=>{'use strict';
const CELL=64,SCALE=20;
let busy=false;
/* Extract the smallest alpha-visible bounding rectangle, centered in a
 * square whose side length is max(width,height). Only the shorter dimension
 * receives transparent pixels (if any), with any odd extra on right/bottom.
 * This includes all equipped items, capes, tails, and weapon muzzle pixels.
 * No fixed outside margin is added. Empty images retain a 64x64 square. */
function cropIdle(frame,bounds){
 if(!frame||frame.length!==CELL*CELL*4)throw Error('Expected a 64×64 RGBA idle frame');
 if(!bounds)return {pixels:new Uint8ClampedArray(frame),width:CELL,height:CELL};
 const {left:x0,top:y0,right:x1,bottom:y1}=bounds;
 const w=x1-x0,h=y1-y0,side=Math.max(w,h);
 const left=Math.floor((side-w)/2),top=Math.floor((side-h)/2);
 const pixels=new Uint8ClampedArray(side*side*4);
 for(let y=0;y<h;y++){
  const from=((y+y0)*CELL+x0)*4,to=((y+top)*side+left)*4;
  pixels.set(frame.subarray(from,from+w*4),to);
 }
 return {pixels,width:side,height:side};
}
function imageURL(){
 const idle=window.MUTTSSpriteAtlas.idle();
 if(!idle)throw Error('Idle sprite not available. Choose a character or change an item first.');
 // Browser PNG encoder, but the UI control is an actual Unity Button.
 const cropped=cropIdle(idle.frame,idle.bounds);
 const src=document.createElement('canvas');src.width=cropped.width;src.height=cropped.height;
 const s=src.getContext('2d',{alpha:true});if(!s)throw Error('2D image canvas unavailable');
 s.putImageData(new ImageData(cropped.pixels,cropped.width,cropped.height),0,0);
 const output=document.createElement('canvas');output.width=cropped.width*SCALE;output.height=cropped.height*SCALE;
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
 // Custom download names pass through unchanged.
 if(!internalDownload&&/^(?:PixelHero-Idle-20x|SpriteSheet)\.png$/i.test(name)){ 
  try{
   const url=imageURL();
   this.href=url;this.download=(name==='PixelHero-Idle-20x.png'?'SpriteSheet.png':name);
  }catch(e){console.warn('Native export conversion failed; preserving original save:',e);}
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
  return true;
 }catch(e){console.error('Unity native Export button:',e);
  if(typeof window.alert==='function')window.alert('Export failed: '+e.message);
  return false;
 }finally{busy=false;}
}
window.MUTTSExport={download:exportIdle};
// Capture before Unity's keyboard listener. Tab keeps browser focus traversal.
window.addEventListener('keydown',ev=>{
 const active=document.activeElement;
 if(active&&/^(input|textarea|select)$/i.test(active.tagName))return;
 if(!active||active===document.body||active.id==='unity-canvas'){
  if(ev.ctrlKey||ev.metaKey||ev.altKey||ev.key==='Escape')return;
  if(ev.key==='Tab'){ev.stopImmediatePropagation();return;}
  if(active?.id==='unity-canvas'&&!ev.repeat)window.MUTTSRandomize?.submit?.(ev.key);
  ev.preventDefault();ev.stopImmediatePropagation();
 }
},true);
})();
