/* Read the active Unity sprite's first idle tile for preview and PNG export. */
(() => {
  'use strict';

  const width = 576, height = 928, tile = 64, idleY = 64;
  const contexts = new WeakMap(), frames = new WeakMap(), spritePrograms = new WeakMap();
  let activeTexture = null;

  function state(gl) {
    if (!contexts.has(gl)) {
      contexts.set(gl, { unit: 0, bound: new Map(), program: null, sprite: false, screen: true });
      if (gl.canvas.id === 'unity-canvas') {
        gl.canvas.addEventListener('webglcontextrestored', () => {
          contexts.delete(gl);
          activeTexture = null;
        }, { capture: true, once: true });
      }
    }
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

  function createPreview(gl) {
    // The preview slot is measured in the Unity canvas's 960×600 design space.
    // Its 192×192 quad shows the 64×64 idle cell at three design pixels per texel.
    const vertexSource = `#version 300 es
      uniform float viewportAspect;
      out vec2 uv;
      void main() {
        uv = vec2(gl_VertexID & 1, gl_VertexID >> 1);
        vec2 p = vec2(152.0, 230.0) + uv * 192.0 - vec2(480.0, 300.0);
        // Unity centers its design space and scales it by viewport height.
        vec2 clip = p / vec2(300.0 * viewportAspect, -300.0);
        gl_Position = vec4(clip, 0.0, 1.0);
      }`;
    const fragmentSource = `#version 300 es
      precision highp float;
      uniform sampler2D atlas;
      in vec2 uv;
      out vec4 pixel;
      void main() {
        ivec2 p = clamp(ivec2(uv * ${tile}.0), ivec2(0), ivec2(${tile - 1}));
        vec4 rgba = texelFetch(atlas, ivec2(p.x, ${height - 1 - idleY} - p.y), 0);
        pixel = vec4(rgba.rgb * rgba.a, rgba.a);
      }`;
    const program = gl.createProgram();
    if (!program) return null;
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const shader = gl.createShader(type);
      if (!shader) {
        gl.deleteProgram(program);
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    const vao = gl.getProgramParameter(program, gl.LINK_STATUS) && gl.createVertexArray();
    if (vao) return { program, vao, aspect: gl.getUniformLocation(program, 'viewportAspect') };
    gl.deleteProgram(program);
    return null;
  }

  const gl = window.WebGL2RenderingContext?.prototype;
  if (gl) {
    const useProgram = gl.useProgram;
    const drawArrays = gl.drawArrays;

    function renderPreview(ctx, s) {
      if (s.preview === undefined) s.preview = createPreview(ctx);
      if (!s.preview) return false;
      const vao = ctx.getParameter(ctx.VERTEX_ARRAY_BINDING);
      const depthTest = ctx.isEnabled(ctx.DEPTH_TEST);
      // Unity's sprite pass is already blending premultiplied alpha. Use its
      // bound atlas on unit 0 and leave its framebuffer, viewport and blend state in place.
      try {
        useProgram.call(ctx, s.preview.program);
        ctx.uniform1f(s.preview.aspect, ctx.drawingBufferWidth / ctx.drawingBufferHeight);
        ctx.bindVertexArray(s.preview.vao);
        if (depthTest) ctx.disable(ctx.DEPTH_TEST);
        drawArrays.call(ctx, ctx.TRIANGLE_STRIP, 0, 4);
      } finally {
        if (depthTest) ctx.enable(ctx.DEPTH_TEST);
        ctx.bindVertexArray(vao);
        useProgram.call(ctx, s.program);
      }
      return true;
    }

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
    observe('bindFramebuffer', (ctx, [target, framebuffer]) => {
      if (target === ctx.FRAMEBUFFER || target === ctx.DRAW_FRAMEBUFFER) state(ctx).screen = !framebuffer;
    });
    observe('useProgram', (ctx, [program]) => {
      const s = state(ctx);
      s.program = program || null;
      s.sprite = isSpriteProgram(ctx, program);
    });
    observe('texImage2D', (ctx, args) => recordUpload(ctx, args, false));
    observe('texSubImage2D', (ctx, args) => recordUpload(ctx, args, true));

    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const draw = gl[name];
      if (!draw) continue;
      gl[name] = function (...args) {
        const s = state(this);
        if (s.sprite && s.screen && this.canvas.id === 'unity-canvas') {
          const texture = s.bound.get(0);
          if (frames.has(texture)) {
            activeTexture = texture;
            if (renderPreview(this, s)) return;
          } else if (s.preview && frames.has(activeTexture)) {
            // Body's atlas already includes the firearm. Skip Unity's separate firearm draw.
            return;
          }
        }
        return draw.apply(this, args);
      };
    }
  }

  window.MUTTSSpriteAtlas = { idleFrame: () => frames.get(activeTexture) };
})();
