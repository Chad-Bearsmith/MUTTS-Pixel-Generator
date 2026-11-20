/* Read the active Unity sprite's first idle tile for preview and PNG export. */
(() => {
  'use strict';

  const width = 576, height = 928, tile = 64, idleY = 64;
  const contexts = new WeakMap(), frames = new WeakMap(), spritePrograms = new WeakMap();
  let activeTexture = null;

  function state(gl) {
    if (!contexts.has(gl)) contexts.set(gl, { unit: 0, bound: new Map(), sprite: false });
    return contexts.get(gl);
  }

  function isSpriteProgram(gl, program) {
    if (!program) return false;
    if (!spritePrograms.has(program)) {
      const names = new Set();
      const count = Math.min(96, gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) || 0);
      for (let i = 0; i < count; ++i) names.add(gl.getActiveUniform(program, i)?.name);
      spritePrograms.set(program, names.has('_Flip') && names.has('_RendererColor') && !names.has('_ClipRect'));
    }
    return spritePrograms.get(program);
  }

  function recordUpload(gl, args, subImage) {
    const s = state(gl), texture = s.bound.get(s.unit);
    if (!texture || args[0] !== gl.TEXTURE_2D || args[1] !== 0) return;
    const w = args[subImage ? 4 : 3], h = args[subImage ? 5 : 4];
    const source = args[8], offset = args[9] ?? 0;
    if (w !== width || h !== height || (subImage && (args[2] !== 0 || args[3] !== 0)) ||
        args[6] !== gl.RGBA || args[7] !== gl.UNSIGNED_BYTE ||
        !ArrayBuffer.isView(source) || source.BYTES_PER_ELEMENT !== 1 ||
        !Number.isInteger(offset) || offset < 0 || offset + width * height * 4 > source.byteLength) {
      frames.delete(texture);
      return;
    }
    const input = new Uint8Array(source.buffer, source.byteOffset + offset, width * height * 4);
    const frame = new Uint8ClampedArray(tile * tile * 4);
    for (let y = 0; y < tile; ++y) {
      const start = (height - 1 - idleY - y) * width * 4;
      frame.set(input.subarray(start, start + tile * 4), y * tile * 4);
    }
    frames.set(texture, frame);
  }

  const gl = window.WebGL2RenderingContext?.prototype;
  if (gl) {
    function observe(name, update) {
      const original = gl[name];
      if (!original) return;
      gl[name] = function (...args) {
        const result = original.apply(this, args);
        update(this, args);
        return result;
      };
    }
    observe('activeTexture', (ctx, [unit]) => { state(ctx).unit = unit - ctx.TEXTURE0; });
    observe('bindTexture', (ctx, [target, texture]) => {
      if (target === ctx.TEXTURE_2D) state(ctx).bound.set(state(ctx).unit, texture);
    });
    observe('deleteTexture', (_ctx, [texture]) => { frames.delete(texture); });
    observe('useProgram', (ctx, [program]) => { state(ctx).sprite = isSpriteProgram(ctx, program); });
    observe('texImage2D', (ctx, args) => recordUpload(ctx, args, false));
    observe('texSubImage2D', (ctx, args) => recordUpload(ctx, args, true));

    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const draw = gl[name];
      if (!draw) continue;
      gl[name] = function (...args) {
        const s = state(this);
        if (s.sprite) {
          const texture = s.bound.get(0);
          if (frames.has(texture)) {
            activeTexture = texture;
            if (window.PHMIdleFrame.ready()) return;
          }
        }
        return draw.apply(this, args);
      };
    }
  }

  window.PHMSpriteAtlas = { idleFrame: () => frames.get(activeTexture) };
})();
