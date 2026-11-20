/* Pixel Hero Maker [v.51] — IN-FRAME pixel-identical static preview.
 * Native Unity buttons and selections remain unchanged. The SpriteRenderer
 * draw is suppressed only while the corrected 64x64 frame is available;
 * the compositor probe (installed AFTER this wrapper) still sees its bound
 * atlas and drives the existing native Export button. Native scene art and
 * Unity data are not edited by this preview bridge.
 * This is browser-assisted rendering inside the Unity canvas container,
 * not a modified compiled Unity SpriteRenderer. Fail open if unsupported.
 */
(()=>{'use strict';
const contexts=new WeakMap(),programs=new WeakMap();
const stats={version:'v.51',drawsSuppressed:0,drawsAllowed:0,spritePrograms:0,failures:0,
 lastError:null,active:false};
function classify(gl,p){
 if(!p)return false;
 if(programs.has(p))return programs.get(p);
 let sprite=false;
 try{
  const count=Math.min(128,gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS)||0);
  let flip=false,rendererColor=false,clipRect=false;
  for(let i=0;i<count;i++){
   const u=gl.getActiveUniform(p,i);
   if(u?.name==='_Flip')flip=true;
   if(u?.name==='_RendererColor')rendererColor=true;
   if(u?.name==='_ClipRect')clipRect=true;
  }
  sprite=flip&&rendererColor&&!clipRect;
  if(sprite)stats.spritePrograms++;
 }catch(e){stats.failures++;stats.lastError=String(e);}
 programs.set(p,sprite);return sprite;
}
function install(proto){
 if(!proto||proto.__phmPreviewInlineInstalled)return;
 const orig=proto.useProgram;
 if(typeof orig!=='function')return;
 proto.useProgram=function(...args){
  const v=orig.apply(this,args);contexts.set(this,classify(this,args[0]));return v;
 };
 for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
  const draw=proto[name];if(typeof draw!=='function')continue;
  proto[name]=function(...args){
   const ready=window.PHMIdleFrame?.report?.().ready===true;
   // If the export compositor is absent, do not hide the game's artwork.
   if(ready&&contexts.get(this)){
    stats.drawsSuppressed++;stats.active=true;return;
   }
   stats.drawsAllowed++;return draw.apply(this,args);
  };
 }
 Object.defineProperty(proto,'__phmPreviewInlineInstalled',{value:true});
}
const proto=typeof WebGL2RenderingContext==='undefined'?null:WebGL2RenderingContext.prototype;
if(proto)install(proto);
window.PHMPreviewInline={report:()=>({...stats})};
})();
