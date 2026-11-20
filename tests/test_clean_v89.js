'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const version=process.argv[3]||'v.89';
const root=process.argv[2],src=n=>fs.readFileSync(path.join(root,n),'utf8');
const index=src('index.html');const names=[...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
assert.deepEqual(names,['phm-static-idle.js','phm-preview-inline.js','phm-compositor-probe.js','offline-ui.js','phm-v76-layer-provenance.js','phm-diagnostics-ui.js']);
for(const name of names){assert(fs.existsSync(path.join(root,name)),name)}
for(const name of ['phm-live-skin-repair.js','phm-final-frame-compositor.js','phm-geometry-review.js','phm-firearm-geometry.js','phm-idle-weapon-guard.js','phm-v56-fixed-hand.js','phm-v58-auto-hand.js','phm-session-recorder.js','firearm-skin-repair.js'])assert(!fs.existsSync(path.join(root,name)),name+' must be removed');
assert(index.includes(`<title>Pixel Hero Maker [${version}]</title>`));
assert(index.includes(`productName: "Pixel Hero Maker [${version}]"`));
assert(index.includes(`productVersion: "${version}"`));
// Old geometry path must have no references or dependency, not merely a disabled flag.
assert(!/PHMFinalFrameCompositor|PHMGeometryReview|PHMLiveSkinRepair/.test(src('phm-static-idle.js')));
assert(!/PHMV56HandResolver|PHMV58AutoHand/.test(src('phm-v76-layer-provenance.js')));
let drawCalls=0,uploadCalls=0,uploaded=null;
class MockGL{
 constructor(){this.TEXTURE_2D=3553;this.TEXTURE0=33984;this.RGBA=6408;this.UNSIGNED_BYTE=5121;this.FRAMEBUFFER=36160;this.DRAW_FRAMEBUFFER=36009;}
 activeTexture(){} bindTexture(){} createTexture(){return {tag:'texture'}} deleteTexture(){}
 useProgram(){} getProgramParameter(){return 0;}
 drawArrays(){drawCalls++} texImage2D(...a){uploadCalls++;uploaded=a;return 'uploaded'}
 texSubImage2D(...a){uploadCalls++;uploaded=a;return 'subuploaded'}
}
class Anchor{constructor(){this.download='';this.href='';}click(){clicked.push({name:this.download,href:this.href});return 'clicked'}remove(){}getAttribute(k){return this[k]}}
const clicked=[];const nodes={};let lastCanvas=null;const listeners={};
const makeContext=()=>({clearRect(){},putImageData(){},drawImage(){},imageSmoothingEnabled:true});
const doc={readyState:'loading',body:{appendChild(){}},addEventListener(n,f){listeners[n]=f},
 getElementById(id){if(id==='phm-native-preview-surface')return {getContext:makeContext};return nodes[id]||null},
 createElement(tag){if(tag==='a')return new Anchor();if(tag==='canvas'){lastCanvas={width:0,height:0,getContext:makeContext,toDataURL(){return 'data:image/png;base64,dGVzdA=='}};return lastCanvas; } return {}},};
const context={window:{},document:doc,HTMLAnchorElement:Anchor,WebGL2RenderingContext:MockGL,
 ImageData:class{constructor(p,w,h){this.data=p;this.width=w;this.height=h}},
 setInterval(){return 1},setTimeout(){return 1},console,Uint8Array,Uint8ClampedArray,ArrayBuffer,DataView,Math,Map,Set,WeakMap,Date,
 fetch:undefined,performance:{now:()=>0}, URL:{},Blob:class{}};
context.window.window=context.window;context.window.document=doc;
vm.createContext(context);
for(const name of ['phm-static-idle.js','phm-preview-inline.js','phm-compositor-probe.js'])vm.runInContext(src(name),context,{filename:name});
const gl=new MockGL(),tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
const raw=new Uint8Array(576*928*4);const atlasX=27,atlasY=64+19;
// WebGL uploads are upside down relative to the browser image.
const p=((928-1-atlasY)*576+atlasX)*4;raw.set([37,91,205,255],p);
assert.equal(gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,576,928,0,gl.RGBA,gl.UNSIGNED_BYTE,raw),'uploaded');
assert.strictEqual(uploaded[8],raw,'WebGL upload pixel-array identity must be preserved');
assert.equal(uploadCalls,1);
const atlas=context.window.PHMCompositorProbe.activeSpriteImage();
// Draw observer chooses active sprite atlas only after a SpriteRenderer is drawn;
// test direct idle extraction using the known top-down pixels if no draw yet.
const topdown=new Uint8Array(576*928*4);topdown.set([37,91,205,255],((64+19)*576+27)*4);
context.window.PHMCompositorProbe.activeSpriteImage=()=>({width:576,height:928,rgba:topdown,id:8,hash:'test'});
assert.equal(context.window.PHMIdleFrame.refresh(),true);
assert.equal(context.window.PHMIdleFrame.report().ready,true);
assert.equal(context.window.PHMIdleFrame.report().previewUpdates,1);
assert.equal(context.window.PHMIdleFrame.report().version,version);
assert.deepEqual(Array.from(context.window.PHMIdleFrame.extractFirstIdle(topdown).subarray((19*64+27)*4,(19*64+27)*4+4)),[37,91,205,255]);
assert(context.window.PHMIdleFrame.exportIdle());
assert.equal(clicked.at(-1).name,'SpriteSheet.png');
assert.equal(context.window.PHMIdleFrame.report().outputPixelSize[0],20);
assert.equal(context.window.PHMIdleFrame.report().outputPixelSize[1],20);
// Diagnostic downloads must be excluded from known native export interception.
const a=new Anchor();a.download='PixelHero-v89-ArmSources.png';a.href='blob:unmodified';a.click();
assert.equal(clicked.at(-1).href,'blob:unmodified');
assert.equal(clicked.at(-1).name,'PixelHero-v89-ArmSources.png');
const s=new Anchor();s.download='SpriteSheet.png';s.href='blob:unity-export';s.click();
assert.equal(clicked.at(-1).href,'data:image/png;base64,dGVzdA==');
const mip=new Uint8Array(288*464*4);assert.equal(gl.texImage2D(gl.TEXTURE_2D,1,gl.RGBA,288,464,0,gl.RGBA,gl.UNSIGNED_BYTE,mip),'uploaded');assert.strictEqual(uploaded[8],mip);
const sub=new Uint8Array(16*4);assert.equal(gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,4,4,gl.RGBA,gl.UNSIGNED_BYTE,sub),'subuploaded');assert.strictEqual(uploaded[8],sub);
assert.equal(uploadCalls,3);
assert(!context.window.PHMLiveSkinRepair && !context.window.PHMFinalFrameCompositor);
console.log('PASS: exactly 6 active scripts; all legacy geometry modules physically removed; Unity atlas uploads unchanged; direct idle frame; SpriteSheet export; diagnostic download preserved');
