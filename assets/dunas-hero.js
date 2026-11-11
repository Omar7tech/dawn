/*
  DUNAS hero pointer effect.

  Light: a soft pool of light follows the pointer across the photo, like sun moving over sand.
  Its colour is taken from the photo itself: a tiny copy of the hero image is read once, its
  most characteristic tone is lifted into a light of the same hue, and bright photos get a
  gentler blend than dark ones. So any photo the merchant picks gets a light that belongs to it.

  Depth: the photo drifts a little against the pointer and the tall logo a little with it, so
  the hero reads as layers with depth. Both glide on a smoothed follow, only while the pointer
  is over the hero, and rest when it leaves.

  Mouse and pen only; touch screens and reduced motion keep the hero still.
  Mirage, the default, is described above initMirage.

  Settings on the section: data-pointer (mirage | light_depth | light | depth | off),
  data-pointer-strength (1-10), data-pointer-colour (auto | sand | white), data-sample (image).
*/
(() => {
  const SAND = '232, 205, 178';
  const WHITE = '255, 250, 242';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const toHsl = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  };

  const toRgb = (h, s, l) => {
    const hue = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    if (s === 0) return [l, l, l].map((v) => Math.round(v * 255));
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)].map((v) => Math.round(v * 255));
  };

  // Read the photo's own tone from a 16px copy and turn it into a light of the same hue
  const sampleColour = (hero) => {
    const src = hero.dataset.sample;
    if (!src) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const size = 16;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        let r = 0;
        let g = 0;
        let b = 0;
        let weight = 0;
        let lum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const [, s, l] = toHsl(data[i], data[i + 1], data[i + 2]);
          // colourful mid-tones speak for the photo; greys, blacks and blown highlights less
          const w = 0.15 + s * (1 - Math.abs(l - 0.5) * 2);
          r += data[i] * w;
          g += data[i + 1] * w;
          b += data[i + 2] * w;
          weight += w;
          lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        }
        lum /= data.length / 4;

        const [h, s] = toHsl(r / weight, g / weight, b / weight);
        const light = toRgb(h, clamp(s, 0.25, 0.65), 0.8);
        hero.style.setProperty('--hero-glow', light.join(', '));
        hero.classList.toggle('is-bright-photo', lum > 0.58);
      } catch (error) {
        // the image could not be read (cross-origin): the sand light stays
      }
    };
    img.src = src;
  };


  /* ---------------------------------------------------------------------------------------
     Mirage: the photo turns to desert heat haze under the pointer.

     The photo is drawn by WebGL on a canvas laid exactly over the <img> (same cover fit and
     focus point). A tiny 2D "trail" canvas records where the pointer went: red and green hold
     the direction it moved, blue how hard. Each frame the trail fades toward still air, and the
     shader bends the photo along it, splitting red and blue a little at the bend, as light
     splits through hot air. Rendering only runs while the trail is alive (or the optional heat
     shimmer is on) and while the hero is on screen. Any failure leaves the plain photo.
     --------------------------------------------------------------------------------------- */

  const VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}',
  ].join('\n');

  const FRAG = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D uImage;',
    'uniform sampler2D uTrail;',
    'uniform vec2 uScale;',
    'uniform vec2 uOffset;',
    'uniform float uBend;',
    'uniform float uSplit;',
    'uniform float uTime;',
    'uniform float uShimmer;',
    'vec3 photo(vec2 uv) {',
    '  return texture2D(uImage, clamp(uv, 0.0, 1.0) * uScale + uOffset).rgb;',
    '}',
    'void main() {',
    '  vec4 trail = texture2D(uTrail, vUv);',
    '  vec2 flow = (trail.rg - 0.5) * 2.0 * trail.b;',
    '  float heat = trail.b;',
    // a faint rising shimmer low in the frame, like air over hot sand (optional)
    '  float band = smoothstep(0.35, 1.0, vUv.y);',
    '  vec2 haze = vec2(sin(vUv.y * 140.0 - uTime * 2.4) * 0.0009, sin(vUv.x * 60.0 + uTime * 1.3) * 0.0006) * band * uShimmer;',
    '  vec2 uv = vUv - flow * uBend + haze;',
    '  vec2 split = flow * uBend * uSplit + haze * 0.6;',
    '  vec3 c;',
    '  c.r = photo(uv - split).r;',
    '  c.g = photo(uv).g;',
    '  c.b = photo(uv + split).b;',
    // hot air glows a touch
    '  c += heat * 0.03;',
    '  gl_FragColor = vec4(c, 1.0);',
    '}',
  ].join('\n');

  const compile = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };

  const initMirage = (hero) => {
    const media = hero.querySelector('.dunas-hero__media');
    const img = media && media.querySelector('.dunas-hero__img');
    if (!media || !img) return false;

    const canvas = document.createElement('canvas');
    canvas.className = 'dunas-hero__mirage';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    });
    if (!gl) return false;

    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link');
    } catch (error) {
      return false;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    ['uImage', 'uTrail', 'uScale', 'uOffset', 'uBend', 'uSplit', 'uTime', 'uShimmer'].forEach((name) => {
      u[name] = gl.getUniformLocation(program, name);
    });

    const makeTexture = (unit) => {
      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return texture;
    };
    const imageTexture = makeTexture(0);
    const trailTexture = makeTexture(1);
    gl.uniform1i(u.uImage, 0);
    gl.uniform1i(u.uTrail, 1);

    // settings
    const strength = clamp(Number(hero.dataset.pointerStrength) || 5, 1, 10) / 5;
    const brush = clamp(Number(hero.dataset.mirageSize) || 14, 6, 30) / 100;
    const shimmer = hero.dataset.mirageShimmer === 'true' ? 1 : 0;
    const onTouch = hero.dataset.mirageTouch !== 'false';
    const split = clamp(Number(hero.dataset.mirageSplit ?? 3), 0, 10) / 25;
    gl.uniform1f(u.uBend, 0.034 * strength);
    gl.uniform1f(u.uSplit, split);
    gl.uniform1f(u.uShimmer, shimmer);

    // the trail: direction in red/green around 128, strength in blue, fading to still air
    const trail = document.createElement('canvas');
    const tctx = trail.getContext('2d');
    const TRAIL_W = 128;

    let photo = null;
    let photoSrc = '';
    let width = 0;
    let height = 0;
    let energy = 0;
    let frame = 0;
    let visible = true;
    let last = null;
    const start = performance.now();

    const fitCover = () => {
      if (!photo || !width || !height) return;
      const iw = photo.naturalWidth || photo.width;
      const ih = photo.naturalHeight || photo.height;
      const s = Math.max(width / iw, height / ih);
      const sx = width / (iw * s);
      const sy = height / (ih * s);
      const pos = getComputedStyle(img).objectPosition.split(' ');
      const fx = parseFloat(pos[0]) / 100;
      const fy = parseFloat(pos[1] || pos[0]) / 100;
      gl.uniform2f(u.uScale, sx, sy);
      gl.uniform2f(
        u.uOffset,
        (1 - sx) * (Number.isFinite(fx) ? fx : 0.5),
        (1 - sy) * (Number.isFinite(fy) ? fy : 0.5)
      );
    };

    const uploadTrail = () => {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, trailTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trail);
    };

    const draw = (now) => {
      if (!photo) return;
      uploadTrail();
      gl.uniform1f(u.uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const calm = () => {
      tctx.globalCompositeOperation = 'source-over';
      tctx.fillStyle = 'rgb(128, 128, 0)';
      tctx.fillRect(0, 0, trail.width, trail.height);
    };

    const resize = () => {
      const rect = media.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, Math.round(rect.width * dpr));
      height = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      trail.width = TRAIL_W;
      trail.height = Math.max(8, Math.round((TRAIL_W * rect.height) / Math.max(rect.width, 1)));
      calm();
      fitCover();
      draw(performance.now());
    };

    const loop = (now) => {
      // still air slowly returns
      tctx.globalCompositeOperation = 'source-over';
      tctx.fillStyle = 'rgba(128, 128, 0, 0.055)';
      tctx.fillRect(0, 0, trail.width, trail.height);
      energy *= 0.955;
      if (energy <= 0.01 && !shimmer) calm(); // settle exactly, so the photo rests as it is
      draw(now);
      if (visible && (energy > 0.01 || shimmer)) {
        frame = requestAnimationFrame(loop);
      } else {
        frame = 0;
      }
    };

    const wake = () => {
      if (!frame && visible && photo) frame = requestAnimationFrame(loop);
    };

    const stamp = (x, y, vx, vy, power) => {
      const r = brush * trail.width;
      const red = Math.round(128 + clamp(vx, -1, 1) * 127);
      const green = Math.round(128 + clamp(vy, -1, 1) * 127);
      const blue = Math.round(255 * power);
      const gradient = tctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, 0.55)`);
      gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
      tctx.fillStyle = gradient;
      tctx.beginPath();
      tctx.arc(x, y, r, 0, Math.PI * 2);
      tctx.fill();
    };

    const move = (event) => {
      if (event.pointerType === 'touch' && !onTouch) return;
      if (!photo) return;
      const rect = media.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * trail.width;
      const y = ((event.clientY - rect.top) / rect.height) * trail.height;
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.2) {
          const speed = clamp(dist / 6, 0, 1);
          const steps = Math.min(40, Math.ceil(dist / 1.5));
          for (let i = 1; i <= steps; i += 1) {
            stamp(last.x + (dx * i) / steps, last.y + (dy * i) / steps, dx / dist, dy / dist, 0.35 + speed * 0.65);
          }
          energy = Math.min(1, energy + speed * 0.5 + 0.1);
          wake();
        }
      }
      last = { x, y };
    };

    const reveal = () => hero.classList.add('has-mirage');
    const giveUp = () => {
      // the photo could not be used: keep the plain photo
      hero.classList.remove('has-mirage');
      canvas.remove();
    };

    const upload = (source) => {
      try {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
      } catch (error) {
        return false;
      }
      photo = source;
      fitCover();
      draw(performance.now());
      // show the canvas once the photo's own settle animation has finished
      const running = img.getAnimations ? img.getAnimations().filter((a) => a.playState === 'running') : [];
      if (running.length) Promise.all(running.map((a) => a.finished)).then(reveal, reveal);
      else reveal();
      return true;
    };

    const load = () => {
      const src = img.currentSrc || img.src;
      if (!src || src === photoSrc) return;
      if (!img.complete || !img.naturalWidth) {
        img.addEventListener('load', load, { once: true });
        return;
      }
      photoSrc = src;
      // Shopify serves theme and store images from the shop's own domain, so the photo already
      // on the page can be handed to WebGL as it is: no second download.
      if (upload(img)) return;
      // A photo from another domain: fetch one CORS copy instead.
      const source = new Image();
      source.crossOrigin = 'anonymous';
      source.decoding = 'async';
      source.onload = () => {
        if (!upload(source)) giveUp();
      };
      source.onerror = giveUp;
      source.src = src;
    };

    media.appendChild(canvas);
    resize();
    load();

    new ResizeObserver(() => {
      resize();
      load(); // the <picture> may have switched to another source
    }).observe(media);

    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) wake();
    }).observe(hero);

    hero.addEventListener('pointermove', move, { passive: true });
    hero.addEventListener('pointerleave', () => {
      last = null;
    });
    hero.addEventListener('pointerdown', (event) => {
      last = null;
      move(event);
    });

    canvas.addEventListener('webglcontextlost', () => {
      cancelAnimationFrame(frame);
      hero.classList.remove('has-mirage');
      canvas.remove();
    });

    if (shimmer) wake();
    return true;
  };

  const init = (hero) => {
    if (hero.dataset.fxReady) return;
    hero.dataset.fxReady = 'true';

    let mode = hero.dataset.pointer || 'off';
    if (mode === 'off') return;

    if (mode === 'mirage') {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (initMirage(hero)) return;
      mode = 'light_depth'; // no WebGL: fall back to the light and depth effect
    }
    const useLight = mode !== 'depth';
    const useDepth = mode !== 'light';

    if (useLight) {
      const colour = hero.dataset.pointerColour || 'auto';
      hero.style.setProperty('--hero-glow', colour === 'white' ? WHITE : SAND);
      if (colour === 'auto') sampleColour(hero);
    }

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || still.matches) return;

    hero.classList.add('has-pointer-fx');
    const strength = clamp(Number(hero.dataset.pointerStrength) || 5, 1, 10) / 5;
    const photo = hero.querySelector('.dunas-hero__media > picture, .dunas-hero__media > img');
    const logo = hero.querySelector('.dunas-hero__logo');

    let tx = 0.5;
    let ty = 0.4;
    let x = tx;
    let y = ty;
    let frame = 0;

    const apply = () => {
      if (useLight) {
        hero.style.setProperty('--px', `${(x * 100).toFixed(2)}%`);
        hero.style.setProperty('--py', `${(y * 100).toFixed(2)}%`);
      }
      if (useDepth) {
        const dx = x - 0.5;
        const dy = y - 0.5;
        if (photo) photo.style.translate = `${(-dx * 28 * strength).toFixed(2)}px ${(-dy * 18 * strength).toFixed(2)}px`;
        if (logo) logo.style.translate = `${(dx * 12 * strength).toFixed(2)}px ${(dy * 8 * strength).toFixed(2)}px`;
      }
    };

    const tick = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      apply();
      if (Math.abs(tx - x) > 0.0004 || Math.abs(ty - y) > 0.0004) {
        frame = requestAnimationFrame(tick);
      } else {
        x = tx;
        y = ty;
        apply();
        frame = 0;
      }
    };

    const follow = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    hero.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      const rect = hero.getBoundingClientRect();
      tx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      ty = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      hero.classList.add('is-lit');
      follow();
    });

    hero.addEventListener('pointerleave', () => {
      hero.classList.remove('is-lit');
      tx = 0.5;
      ty = 0.4;
      follow();
    });
  };

  document.querySelectorAll('.dunas-hero[data-pointer]').forEach(init);
  document.addEventListener('shopify:section:load', (event) => {
    const hero = event.target.querySelector('.dunas-hero[data-pointer]');
    if (hero) init(hero);
  });
})();
