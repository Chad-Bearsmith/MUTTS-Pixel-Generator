/* Pixel Hero Maker [v.89] - read-only native and renderer diagnostics. */
(() => { 'use strict';
 const el=id=>document.getElementById(id);
 function report(){return {format:'PixelHero-v89-SystemReport-1',build:'Pixel Hero Maker [v.89]',at:new Date().toISOString(),
  nativeIdleHand:window.PHMV76LayerProvenance?.automaticIdleStatus?.()||null,
  experimentalUnderlay:window.PHMV76LayerProvenance?.experimentalUnderlayStatus?.()||null,
  layerComparison:window.PHMV76LayerProvenance?.report?.()||null,
  renderer:window.PHMCompositorProbe?.report?.()||null,
  idleExporter:window.PHMIdleFrame?.report?.()||null,
  previewDraw:window.PHMPreviewInline?.report?.()||null,
  policy:{browserGeometryWriters:false,browserHandWriters:false,nativeV76IdleHand:true,experimentalNativeUnderlay:true,animationsDisabled:true,tailFixesPresent:false},
  note:'Read-only diagnostic report. Native layer probe calls may access Unity source/palette routines when explicitly requested; they do not append to the visible merge. WebGL atlas observation and browser preview/export remain enabled.'};}
 function download(name,value){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),20000);return blob.size;}
 function init(){const toggle=el('phm-diag-toggle'),panel=el('phm-diag-panel');if(!toggle||!panel)return;
  toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));toggle.textContent=panel.hidden?'Diagnostic mode':'Close diagnostics';});
  el('phm-diag-source')?.addEventListener('click',()=>{try{const n=download('PixelHero-v89-SystemReport.json',report());el('phm-diag-status').textContent='Downloaded current system report ('+n+' bytes).';}catch(e){el('phm-diag-status').textContent='Diagnostic export failed: '+e;}});
 }
 window.PHMV78Diagnostics={report};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
