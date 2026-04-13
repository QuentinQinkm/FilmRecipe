const VERT_SRC = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const MAX_LAYERS = 5;

// --- Pass 1: Density shader ---
// Computes per-layer density with grain noise, outputs as RGBA channels.
// R=layer0, G=layer1, B=layer2, A=layer3 (scaled by 1/4.0 for UNSIGNED_BYTE FBO)
const DENSITY_FRAG_SRC = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uImg;
uniform int uLayerCount;
uniform float uSensPeak[${MAX_LAYERS}];
uniform float uSensBw[${MAX_LAYERS}];
uniform float uToe[${MAX_LAYERS}];
uniform float uGamma[${MAX_LAYERS}];
uniform float uShoulder[${MAX_LAYERS}];
uniform float uDmax[${MAX_LAYERS}];
uniform float uFog[${MAX_LAYERS}];
uniform float uDyeHue[${MAX_LAYERS}];
uniform float uDyePurity[${MAX_LAYERS}];
uniform float uCrystal[${MAX_LAYERS}];
uniform float uStackStr;
uniform vec2 uImgDim;

const vec3 CH = vec3(625.0, 540.0, 450.0);
const float LN10 = 2.302585;
const float DEN_SCALE = 4.0;

float s2l(float c) {
  return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}

float sens(float ch, float pk, float bw) {
  float sigma = bw / 2.355;
  float d = (ch - pk) / sigma;
  return exp(-0.5 * d * d);
}

float hd(float ex, float toe, float gam, float sho, float dm) {
  float t = clamp(ex, 0.0, 1.0);
  float linRange = max(1.0 - toe - sho, 0.01);
  float effRange = max(1.0 - toe * 0.5 - sho * 0.5, 0.01);
  float slope = gam * dm / effRange;
  float den;
  if (t <= toe && toe > 0.001) {
    float r = t / toe;
    den = slope * toe * 0.5 * r * r;
  } else if (t >= 1.0 - sho && sho > 0.001) {
    float denStart = slope * (toe * 0.5 + linRange);
    float s = (t - (1.0 - sho)) / sho;
    den = denStart + slope * sho * 0.5 * (2.0 * s - s * s);
  } else {
    den = slope * (toe * 0.5 + (t - toe));
  }
  return clamp(den, 0.0, dm);
}

vec3 dyeAbs(float hue, float pur) {
  float ah = mod(hue + 180.0, 360.0) / 60.0;
  float x = 1.0 - abs(mod(ah, 2.0) - 1.0);
  vec3 c;
  if      (ah < 1.0) c = vec3(1.0, x,   0.0);
  else if (ah < 2.0) c = vec3(x,   1.0, 0.0);
  else if (ah < 3.0) c = vec3(0.0, 1.0, x  );
  else if (ah < 4.0) c = vec3(0.0, x,   1.0);
  else if (ah < 5.0) c = vec3(x,   0.0, 1.0);
  else               c = vec3(1.0, 0.0, x  );
  return c * pur;
}

// --- Grain engine v3: white noise (blur converts to organic clumps) ---
float grainHash(vec2 p, float seed) {
  return fract(sin(dot(p + seed, vec2(127.1, 311.7))) * 43758.5453) * 2.0 - 1.0;
}

void main() {
  vec4 tx = texture2D(uImg, vUV);
  vec3 lin = vec3(s2l(tx.r), s2l(tx.g), s2l(tx.b));

  int nLayers = uLayerCount;

  float seeds[${MAX_LAYERS}];
  seeds[0] = 0.0;
  seeds[1] = 73.156;
  seeds[2] = 191.329;
  seeds[3] = 347.718;
  seeds[4] = 521.437;

  bool isBW = true;
  for (int i = 0; i < ${MAX_LAYERS}; i++) {
    if (i >= nLayers) break;
    if (uDyePurity[i] >= 0.01) { isBW = false; break; }
  }

  vec4 densities = vec4(0.0);
  vec3 avail = lin;

  if (isBW) {
    vec3 w = vec3(sens(CH.x, uSensPeak[0], uSensBw[0]),
                  sens(CH.y, uSensPeak[0], uSensBw[0]),
                  sens(CH.z, uSensPeak[0], uSensBw[0]));
    float exposure = dot(lin, w) / max(dot(w, vec3(1.0)), 0.001);
    float dm0 = uDmax[0];
    float den = uFog[0] + hd(exposure, uToe[0], uGamma[0], uShoulder[0], dm0);
    den = clamp(den, 0.0, dm0);

    float noise = grainHash(gl_FragCoord.xy, seeds[0]);
    float cs = uCrystal[0];
    float N = 1.0 / (cs * cs + 0.01);
    float p = clamp(den / max(dm0, 0.01), 0.0, 1.0);
    float sigma = sqrt(p * (1.0 - p) / max(N, 0.1));
    den = clamp(den + noise * sigma * dm0 * 1.2, 0.0, dm0);

    densities.r = den / DEN_SCALE;
  } else {
    for (int i = 0; i < ${MAX_LAYERS}; i++) {
      if (i >= nLayers) break;
      vec3 w = vec3(sens(CH.x, uSensPeak[i], uSensBw[i]),
                    sens(CH.y, uSensPeak[i], uSensBw[i]),
                    sens(CH.z, uSensPeak[i], uSensBw[i]));
      float e = dot(avail, w) / max(dot(w, vec3(1.0)), 0.001);
      float d = uFog[i] + hd(e, uToe[i], uGamma[i], uShoulder[i], uDmax[i]);
      d = clamp(d, 0.0, uDmax[i]);

      float noise = grainHash(gl_FragCoord.xy, seeds[i]);
      float cs = uCrystal[i];
      float N = 1.0 / (cs * cs + 0.01);
      float pr = clamp(d / max(uDmax[i], 0.01), 0.0, 1.0);
      float sigma = sqrt(pr * (1.0 - pr) / max(N, 0.1));
      float amplitude = uDyePurity[i] < 0.01 ? 1.2 : 0.7;
      d = clamp(d + noise * sigma * uDmax[i] * amplitude, 0.0, uDmax[i]);

      if (i == 0) densities.r = d / DEN_SCALE;
      else if (i == 1) densities.g = d / DEN_SCALE;
      else if (i == 2) densities.b = d / DEN_SCALE;
      else if (i == 3) densities.a = d / DEN_SCALE;

      if (uStackStr > 0.0) {
        vec3 sa = dyeAbs(uDyeHue[i], uDyePurity[i]) * d;
        avail *= mix(vec3(1.0), exp(-sa * LN10), uStackStr);
      }
    }
  }

  gl_FragColor = densities;
}`;

// --- Pass 2 & 3: Separable Gaussian blur ---
// Operates on all RGBA channels independently = per-layer blur
const BLUR_FRAG_SRC = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uInput;
uniform vec2 uDirection;
uniform float uRadius;
uniform float uKernel[16];

void main() {
  vec4 sum = texture2D(uInput, vUV) * uKernel[0];
  for (int i = 1; i < 16; i++) {
    if (float(i) > uRadius) break;
    vec2 off = uDirection * float(i);
    sum += texture2D(uInput, vUV + off) * uKernel[i];
    sum += texture2D(uInput, vUV - off) * uKernel[i];
  }
  gl_FragColor = sum;
}`;

// --- Pass 4: Compositing shader ---
// Reads blurred per-layer densities, applies DIR + dye absorption + mask/tint
const COMPOSITE_FRAG_SRC = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uDensities;
uniform sampler2D uImg;
uniform int uLayerCount;
uniform float uDmax[${MAX_LAYERS}];
uniform float uDyeHue[${MAX_LAYERS}];
uniform float uDyePurity[${MAX_LAYERS}];
uniform float uReversal;
uniform float uRaw;
uniform float uDir;
uniform float uMaskDen, uMaskHue;
uniform vec3 uBaseTint;
uniform float uPassthrough;

const float LN10 = 2.302585;
const float DEN_SCALE = 4.0;

float l2s(float c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(max(c, 0.0), 1.0/2.4) - 0.055;
}

vec3 dyeAbs(float hue, float pur) {
  float ah = mod(hue + 180.0, 360.0) / 60.0;
  float x = 1.0 - abs(mod(ah, 2.0) - 1.0);
  vec3 c;
  if      (ah < 1.0) c = vec3(1.0, x,   0.0);
  else if (ah < 2.0) c = vec3(x,   1.0, 0.0);
  else if (ah < 3.0) c = vec3(0.0, 1.0, x  );
  else if (ah < 4.0) c = vec3(0.0, x,   1.0);
  else if (ah < 5.0) c = vec3(x,   0.0, 1.0);
  else               c = vec3(1.0, 0.0, x  );
  return c * pur;
}

void main() {
  if (uPassthrough > 0.5) {
    gl_FragColor = texture2D(uImg, vUV);
    return;
  }

  vec4 denTex = texture2D(uDensities, vUV);
  int nLayers = uLayerCount;

  bool isBW = true;
  for (int i = 0; i < ${MAX_LAYERS}; i++) {
    if (i >= nLayers) break;
    if (uDyePurity[i] >= 0.01) { isBW = false; break; }
  }
  bool isPos = !isBW && uReversal > 0.5;
  bool isNeg = !isBW && uReversal < 0.5;

  vec3 out3;

  if (isBW) {
    float dm0 = uDmax[0];
    float den = denTex.r * DEN_SCALE;
    float lum = uRaw > 0.5 ? 1.0 - den / dm0 : den / dm0;
    lum = clamp(lum, 0.0, 1.0);
    out3 = vec3(lum) * uBaseTint;
  } else {
    // Read per-layer densities from RGBA channels
    float dn[${MAX_LAYERS}];
    dn[0] = denTex.r * DEN_SCALE;
    dn[1] = denTex.g * DEN_SCALE;
    dn[2] = denTex.b * DEN_SCALE;
    dn[3] = denTex.a * DEN_SCALE;
    // Layer 4 not supported in channel-parallel blur (no 5th channel)

    // Apply reversal
    if (isPos) {
      for (int i = 0; i < ${MAX_LAYERS}; i++) {
        if (i >= nLayers || i > 3) break;
        dn[i] = uDmax[i] - dn[i];
      }
    }

    // DIR inhibition
    float totalDenSum = 0.0;
    for (int i = 0; i < ${MAX_LAYERS}; i++) {
      if (i >= nLayers) break;
      totalDenSum += dn[i];
    }
    float d[${MAX_LAYERS}];
    for (int i = 0; i < ${MAX_LAYERS}; i++) {
      if (i >= nLayers) break;
      float inh = totalDenSum - dn[i];
      d[i] = max(0.0, dn[i] - uDir * inh * 0.15);
    }

    // Total optical density from independently blurred layers
    vec3 totalOD = vec3(0.0);
    for (int i = 0; i < ${MAX_LAYERS}; i++) {
      if (i >= nLayers) break;
      vec3 da = dyeAbs(uDyeHue[i], uDyePurity[i]);
      totalOD += da * d[i];
    }

    if (isNeg && uRaw < 0.5) {
      float scanExp = 3.0;
      out3 = vec3(1.0) - exp(-totalOD * scanExp);
    } else if (isNeg) {
      float mh = clamp(uMaskHue / 60.0, 0.0, 1.0);
      vec3 maskOD = vec3(uMaskDen * mix(0.65, 0.45, mh),
                         uMaskDen * mix(0.15, 0.40, mh),
                         uMaskDen * mix(0.05, 0.10, mh));
      out3 = exp(-(totalOD + maskOD) * LN10);
    } else {
      out3 = exp(-totalOD * LN10);
    }

    out3 *= uBaseTint;
  }

  gl_FragColor = vec4(l2s(out3.r), l2s(out3.g), l2s(out3.b), 1.0);
}`;

export class FilmRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false });
    this.hasImage = false;
    this.imageWidth = 0;
    this.imageHeight = 0;
    this.fboA = null;
    this.fboB = null;
    if (this.gl) {
      this._initGL();
    }
  }

  get isWebGL() { return !!this.gl; }

  _initGL() {
    const gl = this.gl;

    // Compile shared vertex shader
    const vs = this._compile(gl.VERTEX_SHADER, VERT_SRC);

    // --- Density program ---
    const densFs = this._compile(gl.FRAGMENT_SHADER, DENSITY_FRAG_SRC);
    this.densProg = this._linkProgram(gl, vs, densFs);
    if (!this.densProg) { this.gl = null; return; }

    this.densU = {};
    for (const n of ['uImg', 'uLayerCount', 'uStackStr', 'uImgDim']) {
      this.densU[n] = gl.getUniformLocation(this.densProg, n);
    }
    this.densArrays = {};
    for (const name of ['uSensPeak','uSensBw','uToe','uGamma','uShoulder','uDmax','uFog','uDyeHue','uDyePurity','uCrystal']) {
      this.densArrays[name] = [];
      for (let i = 0; i < MAX_LAYERS; i++) {
        this.densArrays[name].push(gl.getUniformLocation(this.densProg, `${name}[${i}]`));
      }
    }

    // --- Blur program ---
    const blurFs = this._compile(gl.FRAGMENT_SHADER, BLUR_FRAG_SRC);
    this.blurProg = this._linkProgram(gl, vs, blurFs);
    this.blurU = {
      uInput: gl.getUniformLocation(this.blurProg, 'uInput'),
      uDirection: gl.getUniformLocation(this.blurProg, 'uDirection'),
      uRadius: gl.getUniformLocation(this.blurProg, 'uRadius'),
      uKernel: [],
    };
    for (let i = 0; i < 16; i++) {
      this.blurU.uKernel.push(gl.getUniformLocation(this.blurProg, `uKernel[${i}]`));
    }

    // --- Compositing program ---
    const compFs = this._compile(gl.FRAGMENT_SHADER, COMPOSITE_FRAG_SRC);
    this.compProg = this._linkProgram(gl, vs, compFs);
    this.compU = {};
    for (const n of ['uDensities', 'uImg', 'uLayerCount', 'uReversal', 'uRaw', 'uDir', 'uMaskDen', 'uMaskHue', 'uBaseTint', 'uPassthrough']) {
      this.compU[n] = gl.getUniformLocation(this.compProg, n);
    }
    this.compArrays = {};
    for (const name of ['uDmax', 'uDyeHue', 'uDyePurity']) {
      this.compArrays[name] = [];
      for (let i = 0; i < MAX_LAYERS; i++) {
        this.compArrays[name].push(gl.getUniformLocation(this.compProg, `${name}[${i}]`));
      }
    }

    // --- Shared quad buffer ---
    const quad = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    this.texture = gl.createTexture();
  }

  _linkProgram(gl, vs, fs) {
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Link error:', gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  _compile(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(s));
    }
    return s;
  }

  _ensureFBOs(width, height) {
    const gl = this.gl;
    if (!gl) return;

    for (const fbo of [this.fboA, this.fboB]) {
      if (fbo) {
        gl.deleteFramebuffer(fbo.fb);
        gl.deleteTexture(fbo.tex);
      }
    }

    const createFBO = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fb, tex };
    };

    this.fboA = createFBO();
    this.fboB = createFBO();
  }

  _computeGaussianKernel(radius) {
    const r = Math.ceil(radius);
    const sigma = Math.max(radius / 2.5, 0.001);
    const kernel = new Float32Array(16);
    let total = 0;
    for (let i = 0; i <= Math.min(r, 15); i++) {
      kernel[i] = Math.exp(-i * i / (2 * sigma * sigma));
      total += i === 0 ? kernel[i] : 2 * kernel[i];
    }
    for (let i = 0; i <= Math.min(r, 15); i++) kernel[i] /= total;
    return kernel;
  }

  _useProgram(prog) {
    const gl = this.gl;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  setImage(source, w, h) {
    this.imageWidth = w;
    this.imageHeight = h;
    if (this.gl) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this._ensureFBOs(w, h);
    }
    this._sourceCanvas = (source instanceof HTMLCanvasElement) ? source : null;
    if (this._sourceCanvas) {
      this._cpuSource = this._sourceCanvas.getContext('2d').getImageData(0, 0, w, h);
    } else if (!this.gl) {
      this._cpuSource = source.getContext('2d').getImageData(0, 0, w, h);
    }
    this.hasImage = true;
  }

  render(recipe, rawMode) {
    if (!this.hasImage) return;
    if (this.gl) {
      this._renderGL(recipe, rawMode);
    } else {
      const out = this._renderCPU(recipe, rawMode);
      if (out) {
        const { canvas } = this;
        canvas.width = out.width;
        canvas.height = out.height;
        canvas.getContext('2d').putImageData(out, 0, 0);
      }
    }
  }

  _renderGL(recipe, rawMode) {
    const gl = this.gl;
    const { canvas } = this;
    canvas.width = this.imageWidth;
    canvas.height = this.imageHeight;
    const w = canvas.width, h = canvas.height;

    const L = recipe.layers;
    const n = Math.min(L.length, MAX_LAYERS);
    const g = recipe.global;

    // Compute blur radius from max crystal size
    const GRAIN_PX = 10;
    const maxCS = Math.max(...L.map(l => l.crystalSize || 0.3));
    const blurRadius = maxCS * GRAIN_PX;
    const needsBlur = blurRadius >= 0.5 && this.fboA && this.fboB;

    // --- Pass 1: Density shader → FBO A ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA.fb);
    gl.viewport(0, 0, w, h);
    this._useProgram(this.densProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.densU.uImg, 0);
    gl.uniform1i(this.densU.uLayerCount, n);
    gl.uniform2f(this.densU.uImgDim, w, h);
    gl.uniform1f(this.densU.uStackStr, g.stackingStrength || 0);

    for (let i = 0; i < MAX_LAYERS; i++) {
      const layer = i < n ? L[i] : {};
      gl.uniform1f(this.densArrays.uSensPeak[i], layer.sensitizerPeak ?? 550);
      gl.uniform1f(this.densArrays.uSensBw[i], layer.sensitizerBw ?? 100);
      gl.uniform1f(this.densArrays.uToe[i], layer.hdToe ?? 0.2);
      gl.uniform1f(this.densArrays.uGamma[i], layer.hdGamma ?? 0.7);
      gl.uniform1f(this.densArrays.uShoulder[i], layer.hdShoulder ?? 0.15);
      gl.uniform1f(this.densArrays.uDmax[i], layer.dmax ?? 2.0);
      gl.uniform1f(this.densArrays.uFog[i], layer.fog ?? 0);
      gl.uniform1f(this.densArrays.uDyeHue[i], layer.dyeHue ?? 0);
      gl.uniform1f(this.densArrays.uDyePurity[i], layer.dyePurity ?? 0);
      gl.uniform1f(this.densArrays.uCrystal[i], layer.crystalSize ?? 0.3);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // --- Pass 2 & 3: Separable Gaussian blur ---
    if (needsBlur) {
      const kernel = this._computeGaussianKernel(blurRadius);
      this._useProgram(this.blurProg);
      gl.uniform1f(this.blurU.uRadius, blurRadius);
      for (let i = 0; i < 16; i++) gl.uniform1f(this.blurU.uKernel[i], kernel[i]);

      // Pass 2: H blur FBO A → FBO B
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB.fb);
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fboA.tex);
      gl.uniform1i(this.blurU.uInput, 0);
      gl.uniform2f(this.blurU.uDirection, 1.0 / w, 0.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Pass 3: V blur FBO B → FBO A (reuse)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA.fb);
      gl.viewport(0, 0, w, h);
      gl.bindTexture(gl.TEXTURE_2D, this.fboB.tex);
      gl.uniform2f(this.blurU.uDirection, 0.0, 1.0 / h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // --- Pass 4: Compositing shader FBO A → screen ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    this._useProgram(this.compProg);

    // Bind blurred density texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboA.tex);
    gl.uniform1i(this.compU.uDensities, 0);

    // Bind original image for passthrough
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.compU.uImg, 1);

    gl.uniform1i(this.compU.uLayerCount, n);
    gl.uniform1f(this.compU.uPassthrough, 0);
    gl.uniform1f(this.compU.uReversal, g.reversal || 0);
    gl.uniform1f(this.compU.uRaw, rawMode ? 1 : 0);
    gl.uniform1f(this.compU.uDir, g.dirInhibition);
    gl.uniform1f(this.compU.uMaskDen, g.maskDensity);
    gl.uniform1f(this.compU.uMaskHue, g.maskHue);
    gl.uniform3f(this.compU.uBaseTint, g.baseTintR, g.baseTintG, g.baseTintB);

    for (let i = 0; i < MAX_LAYERS; i++) {
      const layer = i < n ? L[i] : {};
      gl.uniform1f(this.compArrays.uDmax[i], layer.dmax ?? 2.0);
      gl.uniform1f(this.compArrays.uDyeHue[i], layer.dyeHue ?? 0);
      gl.uniform1f(this.compArrays.uDyePurity[i], layer.dyePurity ?? 0);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  _renderCPU(recipe, rawMode) {
    const src = this._cpuSource;
    if (!src) return null;
    const { width, height, data } = src;
    const out = new ImageData(width, height);
    const dst = out.data;
    const { layers, global: g } = recipe;
    const isBW = layers.every(l => l.dyePurity < 0.01);
    const isPos = !isBW && (g.reversal || 0) > 0.5;
    const isNeg = !isBW && !isPos;
    const CH = [625, 540, 450];

    function s2l(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    function l2s(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1/2.4) - 0.055; }
    function sens(ch, pk, bw) { const s = bw / 2.355; const d = (ch - pk) / s; return Math.exp(-0.5 * d * d); }
    function hdC(ex, toe, gam, sho, dm) {
      const t = Math.max(0, Math.min(1, ex));
      const linRange = Math.max(1 - toe - sho, 0.01);
      const effRange = Math.max(1 - toe * 0.5 - sho * 0.5, 0.01);
      const slope = gam * dm / effRange;
      let den;
      if (t <= toe && toe > 0.001) { const r = t / toe; den = slope * toe * 0.5 * r * r; }
      else if (t >= 1 - sho && sho > 0.001) { const denStart = slope * (toe * 0.5 + linRange); const s = (t - (1 - sho)) / sho; den = denStart + slope * sho * 0.5 * (2 * s - s * s); }
      else { den = slope * (toe * 0.5 + (t - toe)); }
      return Math.max(0, Math.min(dm, den));
    }
    function dyeA(hue, pur) {
      const ah = ((hue + 180) % 360) / 60;
      const x = 1 - Math.abs(ah % 2 - 1);
      let r, g, b;
      if (ah < 1)      { r=1; g=x; b=0; }
      else if (ah < 2) { r=x; g=1; b=0; }
      else if (ah < 3) { r=0; g=1; b=x; }
      else if (ah < 4) { r=0; g=x; b=1; }
      else if (ah < 5) { r=x; g=0; b=1; }
      else             { r=1; g=0; b=x; }
      return [r * pur, g * pur, b * pur];
    }

    // Grain engine v3: white noise + per-layer blur
    const SEEDS = [0.0, 73.156, 191.329, 347.718, 521.437];

    function grainHash(px, py, seed) {
      const h = (px + seed) * 127.1 + py * 311.7;
      return ((Math.sin(h) * 43758.5453) % 1 + 1) % 1 * 2 - 1;
    }

    function cpuGrain(px, py, cs, density, dm, seed, isDye) {
      const noise = grainHash(px, py, seed);
      const N = 1 / (cs * cs + 0.01);
      const p = Math.max(0, Math.min(1, density / Math.max(dm, 0.01)));
      const sigma = Math.sqrt(p * (1 - p) / Math.max(N, 0.1));
      return noise * sigma * dm * (isDye ? 0.7 : 1.2);
    }

    const LN10 = 2.302585;

    // --- Pass 1: Compute per-layer densities with grain ---
    const layerDensities = layers.map(() => new Float32Array(width * height));

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const px = i % width;
      const py = Math.floor(i / width);
      const sr = s2l(data[idx] / 255);
      const sg = s2l(data[idx+1] / 255);
      const sb = s2l(data[idx+2] / 255);

      let availR = sr, availG = sg, availB = sb;
      const stackStr = g.stackingStrength || 0;

      for (let j = 0; j < layers.length; j++) {
        const L = layers[j];
        const wR = sens(CH[0], L.sensitizerPeak, L.sensitizerBw);
        const wG = sens(CH[1], L.sensitizerPeak, L.sensitizerBw);
        const wB = sens(CH[2], L.sensitizerPeak, L.sensitizerBw);
        const wS = wR + wG + wB || 1;
        const exp = (availR * wR + availG * wG + availB * wB) / wS;
        const dm = isBW ? (L.dmax || 2.0) : L.dmax;
        let d = (L.fog || 0) + hdC(exp, L.hdToe, L.hdGamma, L.hdShoulder, dm);
        d = Math.max(0, Math.min(dm, d));

        // White noise grain
        const isDye = L.dyePurity >= 0.01;
        d = Math.max(0, Math.min(dm, d + cpuGrain(px, py, L.crystalSize, d, dm, SEEDS[j] || 0, isDye)));

        layerDensities[j][i] = d;

        // Stacking attenuation
        if (stackStr > 0) {
          const [aR, aG, aB] = dyeA(L.dyeHue, L.dyePurity);
          const mix = (base, att) => base * (1 - stackStr) + att * stackStr;
          availR = mix(availR, availR * Math.exp(-aR * d * LN10));
          availG = mix(availG, availG * Math.exp(-aG * d * LN10));
          availB = mix(availB, availB * Math.exp(-aB * d * LN10));
        }
      }
    }

    // --- Per-layer Gaussian blur ---
    const GRAIN_PX = 10;
    const maxCS = Math.max(...layers.map(l => l.crystalSize || 0.3));
    const blurRadius = maxCS * GRAIN_PX;

    if (blurRadius >= 0.5) {
      const r = Math.min(Math.ceil(blurRadius), 15);
      const sigma = Math.max(blurRadius / 2.5, 0.001);
      const kernel = [];
      let total = 0;
      for (let i = 0; i <= r; i++) {
        kernel[i] = Math.exp(-i * i / (2 * sigma * sigma));
        total += i === 0 ? kernel[i] : 2 * kernel[i];
      }
      for (let i = 0; i <= r; i++) kernel[i] /= total;

      for (let j = 0; j < layers.length; j++) {
        const src = layerDensities[j];
        const tmp = new Float32Array(width * height);

        // Horizontal pass
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let sum = src[y * width + x] * kernel[0];
            for (let k = 1; k <= r; k++) {
              const xl = Math.max(0, x - k);
              const xr = Math.min(width - 1, x + k);
              sum += src[y * width + xl] * kernel[k];
              sum += src[y * width + xr] * kernel[k];
            }
            tmp[y * width + x] = sum;
          }
        }

        // Vertical pass
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let sum = tmp[y * width + x] * kernel[0];
            for (let k = 1; k <= r; k++) {
              const yt = Math.max(0, y - k);
              const yb = Math.min(height - 1, y + k);
              sum += tmp[yt * width + x] * kernel[k];
              sum += tmp[yb * width + x] * kernel[k];
            }
            layerDensities[j][y * width + x] = sum;
          }
        }
      }
    }

    // --- Pass 2: Composite blurred densities ---
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      let oR, oG, oB;

      if (isBW) {
        const dm0 = layers[0].dmax || 2.0;
        const den = layerDensities[0][i];
        let lum = rawMode ? 1 - den / dm0 : den / dm0;
        lum = Math.max(0, Math.min(1, lum));
        oR = lum * g.baseTintR;
        oG = lum * g.baseTintG;
        oB = lum * g.baseTintB;
      } else {
        const dens = [];
        for (let j = 0; j < layers.length; j++) {
          dens.push(isPos ? layers[j].dmax - layerDensities[j][i] : layerDensities[j][i]);
        }

        // DIR inhibition
        const dir = g.dirInhibition;
        const totalDenSum = dens.reduce((a, b) => a + b, 0);
        const d = dens.map(v => Math.max(0, v - dir * (totalDenSum - v) * 0.15));

        // Dye absorption
        let totR = 0, totG = 0, totB = 0;
        for (let j = 0; j < layers.length; j++) {
          const [aR, aG, aB] = dyeA(layers[j].dyeHue, layers[j].dyePurity);
          totR += aR * d[j]; totG += aG * d[j]; totB += aB * d[j];
        }

        if (isNeg && !rawMode) {
          const scanExp = 3.0;
          oR = 1 - Math.exp(-totR * scanExp);
          oG = 1 - Math.exp(-totG * scanExp);
          oB = 1 - Math.exp(-totB * scanExp);
        } else if (isNeg) {
          const mh = Math.max(0, Math.min(1, g.maskHue / 60));
          const mR = g.maskDensity * (0.65 * (1 - mh) + 0.45 * mh);
          const mG = g.maskDensity * (0.15 * (1 - mh) + 0.40 * mh);
          const mB = g.maskDensity * (0.05 * (1 - mh) + 0.10 * mh);
          oR = Math.exp(-(totR + mR) * LN10);
          oG = Math.exp(-(totG + mG) * LN10);
          oB = Math.exp(-(totB + mB) * LN10);
        } else {
          oR = Math.exp(-totR * LN10);
          oG = Math.exp(-totG * LN10);
          oB = Math.exp(-totB * LN10);
        }
        oR *= g.baseTintR; oG *= g.baseTintG; oB *= g.baseTintB;
      }

      dst[idx]   = Math.round(l2s(Math.max(0, Math.min(1, oR))) * 255);
      dst[idx+1] = Math.round(l2s(Math.max(0, Math.min(1, oG))) * 255);
      dst[idx+2] = Math.round(l2s(Math.max(0, Math.min(1, oB))) * 255);
      dst[idx+3] = 255;
    }
    return out;
  }
}

export function renderFilmCPU(imageData, recipe, rawMode) {
  const tmp = new FilmRenderer(document.createElement('canvas'));
  tmp._cpuSource = imageData;
  tmp.hasImage = true;
  return tmp._renderCPU(recipe, rawMode);
}
