const VERT_SRC = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const MAX_LAYERS = 5;

const FRAG_SRC = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uImg;
uniform sampler2D uNoise;
uniform float uReversal;
uniform float uRaw;
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
uniform float uDir, uMaskDen, uMaskHue;
uniform vec3 uBaseTint;
uniform float uPassthrough;
uniform float uStackStr;
uniform vec2 uImgDim;

const vec3 CH = vec3(625.0, 540.0, 450.0);
const float LN10 = 2.302585;

float s2l(float c) {
  return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}
float l2s(float c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(max(c, 0.0), 1.0/2.4) - 0.055;
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

// Read per-layer noise from RGBA channels of noise texture
// Each channel is an independent random value in [0, 1]
// Converted to [-1, 1] for grain
float layerNoise(int layer) {
  vec4 n = texture2D(uNoise, gl_FragCoord.xy / uImgDim);
  if (layer == 0) return n.r * 2.0 - 1.0;
  if (layer == 1) return n.g * 2.0 - 1.0;
  if (layer == 2) return n.b * 2.0 - 1.0;
  return n.a * 2.0 - 1.0;
}

void main() {
  vec4 tx = texture2D(uImg, vUV);
  if (uPassthrough > 0.5) { gl_FragColor = tx; return; }
  vec3 lin = vec3(s2l(tx.r), s2l(tx.g), s2l(tx.b));

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
    vec3 w = vec3(sens(CH.x, uSensPeak[0], uSensBw[0]),
                  sens(CH.y, uSensPeak[0], uSensBw[0]),
                  sens(CH.z, uSensPeak[0], uSensBw[0]));
    float exposure = dot(lin, w) / max(dot(w, vec3(1.0)), 0.001);
    float dm0 = uDmax[0];
    float den = uFog[0] + hd(exposure, uToe[0], uGamma[0], uShoulder[0], dm0);
    den = clamp(den, 0.0, dm0);

    // Per-pixel noise texture, binomial amplitude from crystal count
    float noise = layerNoise(0);
    float cs = uCrystal[0];
    float N = 1.0 / (cs * cs + 0.01);
    float p = clamp(den / max(dm0, 0.01), 0.0, 1.0);
    float sigma = sqrt(p * (1.0 - p) / max(N, 0.1));
    den = clamp(den + noise * sigma * dm0 * 1.2, 0.0, dm0);

    float lum = uRaw > 0.5 ? 1.0 - den / dm0 : den / dm0;
    lum = clamp(lum, 0.0, 1.0);
    out3 = vec3(lum) * uBaseTint;
  } else {
    float dn[${MAX_LAYERS}];
    vec3 avail = lin;

    for (int i = 0; i < ${MAX_LAYERS}; i++) {
      if (i >= nLayers) break;
      vec3 w = vec3(sens(CH.x, uSensPeak[i], uSensBw[i]),
                    sens(CH.y, uSensPeak[i], uSensBw[i]),
                    sens(CH.z, uSensPeak[i], uSensBw[i]));
      float e = dot(avail, w) / max(dot(w, vec3(1.0)), 0.001);
      float d = uFog[i] + hd(e, uToe[i], uGamma[i], uShoulder[i], uDmax[i]);

      // Per-pixel noise texture, binomial amplitude from crystal count
      float noise = layerNoise(i);
      float cs = uCrystal[i];
      float N = 1.0 / (cs * cs + 0.01);
      float pr = clamp(d / max(uDmax[i], 0.01), 0.0, 1.0);
      float sigma = sqrt(pr * (1.0 - pr) / max(N, 0.1));
      float amplitude = uDyePurity[i] < 0.01 ? 1.2 : 0.7;
      d = clamp(d + noise * sigma * uDmax[i] * amplitude, 0.0, uDmax[i]);
      dn[i] = d;

      // Stacking attenuation
      if (uStackStr > 0.0) {
        vec3 sa = dyeAbs(uDyeHue[i], uDyePurity[i]) * d;
        avail *= mix(vec3(1.0), exp(-sa * LN10), uStackStr);
      }
    }

    // Apply reversal
    if (isPos) {
      for (int i = 0; i < ${MAX_LAYERS}; i++) {
        if (i >= nLayers) break;
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

    // Total optical density
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
    if (this.gl) {
      this._initGL();
    }
  }

  get isWebGL() { return !!this.gl; }

  _initGL() {
    const gl = this.gl;
    const vs = this._compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = this._compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Link error:', gl.getProgramInfoLog(prog));
      this.gl = null;
      return;
    }
    this.prog = prog;
    gl.useProgram(prog);

    const quad = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.texture = gl.createTexture();

    // Noise texture: image-sized RGBA, generated once in setImage()
    // Grain is static — crystal positions don't change when you adjust sliders
    this.noiseTex = gl.createTexture();

    this.u = {};
    for (const n of ['uImg','uNoise','uReversal','uRaw','uDir','uMaskDen','uMaskHue','uBaseTint','uPassthrough','uStackStr','uLayerCount','uImgDim']) {
      this.u[n] = gl.getUniformLocation(prog, n);
    }
    this.uArrays = {};
    for (const name of ['uSensPeak','uSensBw','uToe','uGamma','uShoulder','uDmax','uFog','uDyeHue','uDyePurity','uCrystal']) {
      this.uArrays[name] = [];
      for (let i = 0; i < MAX_LAYERS; i++) {
        this.uArrays[name].push(gl.getUniformLocation(prog, `${name}[${i}]`));
      }
    }
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

  _generateNoise(w, h) {
    const d = new Uint8Array(w * h * 4);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 256) | 0;
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
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
      // Generate static noise texture once per image — grain pattern is fixed
      this._generateNoise(w, h);
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
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(this.prog);

    // Bind image texture to unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.u.uImg, 0);

    // Bind noise texture to unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    gl.uniform1i(this.u.uNoise, 1);

    const L = recipe.layers;
    const n = Math.min(L.length, MAX_LAYERS);

    gl.uniform1f(this.u.uPassthrough, 0);
    gl.uniform1f(this.u.uReversal, recipe.global.reversal || 0);
    gl.uniform1f(this.u.uRaw, rawMode ? 1 : 0);
    gl.uniform1i(this.u.uLayerCount, n);
    gl.uniform2f(this.u.uImgDim, canvas.width, canvas.height);

    for (let i = 0; i < MAX_LAYERS; i++) {
      const layer = i < n ? L[i] : {};
      gl.uniform1f(this.uArrays.uSensPeak[i], layer.sensitizerPeak ?? 550);
      gl.uniform1f(this.uArrays.uSensBw[i], layer.sensitizerBw ?? 100);
      gl.uniform1f(this.uArrays.uToe[i], layer.hdToe ?? 0.2);
      gl.uniform1f(this.uArrays.uGamma[i], layer.hdGamma ?? 0.7);
      gl.uniform1f(this.uArrays.uShoulder[i], layer.hdShoulder ?? 0.15);
      gl.uniform1f(this.uArrays.uDmax[i], layer.dmax ?? 2.0);
      gl.uniform1f(this.uArrays.uFog[i], layer.fog ?? 0);
      gl.uniform1f(this.uArrays.uDyeHue[i], layer.dyeHue ?? 0);
      gl.uniform1f(this.uArrays.uDyePurity[i], layer.dyePurity ?? 0);
      gl.uniform1f(this.uArrays.uCrystal[i], layer.crystalSize ?? 0.3);
    }

    const g = recipe.global;
    gl.uniform1f(this.u.uDir, g.dirInhibition);
    gl.uniform1f(this.u.uMaskDen, g.maskDensity);
    gl.uniform1f(this.u.uMaskHue, g.maskHue);
    gl.uniform3f(this.u.uBaseTint, g.baseTintR, g.baseTintG, g.baseTintB);
    gl.uniform1f(this.u.uStackStr, g.stackingStrength || 0);

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

    const LN10 = 2.302585;

    // Pre-generate per-layer noise arrays using Math.random()
    const layerNoise = layers.map(() => {
      const arr = new Float32Array(width * height);
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.random() * 2 - 1;
      }
      return arr;
    });

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const sr = s2l(data[idx] / 255);
      const sg = s2l(data[idx+1] / 255);
      const sb = s2l(data[idx+2] / 255);
      let oR, oG, oB;

      if (isBW) {
        const L = layers[0];
        const wR = sens(CH[0], L.sensitizerPeak, L.sensitizerBw);
        const wG = sens(CH[1], L.sensitizerPeak, L.sensitizerBw);
        const wB = sens(CH[2], L.sensitizerPeak, L.sensitizerBw);
        const wS = wR + wG + wB || 1;
        const exp = (sr * wR + sg * wG + sb * wB) / wS;
        const dm0 = L.dmax || 2.0;
        let den = (L.fog || 0) + hdC(exp, L.hdToe, L.hdGamma, L.hdShoulder, dm0);
        den = Math.max(0, Math.min(dm0, den));

        // Per-pixel noise, binomial amplitude from crystal count
        const noise = layerNoise[0][i];
        const cs = L.crystalSize ?? 0.3;
        const N = 1 / (cs * cs + 0.01);
        const p = Math.max(0, Math.min(1, den / Math.max(dm0, 0.01)));
        const sigma = Math.sqrt(p * (1 - p) / Math.max(N, 0.1));
        den = Math.max(0, Math.min(dm0, den + noise * sigma * dm0 * 1.2));

        let lum = rawMode ? 1 - den / dm0 : den / dm0;
        lum = Math.max(0, Math.min(1, lum));
        oR = lum * g.baseTintR;
        oG = lum * g.baseTintG;
        oB = lum * g.baseTintB;
      } else {
        const stackStr = g.stackingStrength || 0;
        let availR = sr, availG = sg, availB = sb;
        const dens = [];
        for (let j = 0; j < layers.length; j++) {
          const L = layers[j];
          const wR = sens(CH[0], L.sensitizerPeak, L.sensitizerBw);
          const wG = sens(CH[1], L.sensitizerPeak, L.sensitizerBw);
          const wB = sens(CH[2], L.sensitizerPeak, L.sensitizerBw);
          const wS = wR + wG + wB || 1;
          const exp = (availR * wR + availG * wG + availB * wB) / wS;
          let d = (L.fog || 0) + hdC(exp, L.hdToe, L.hdGamma, L.hdShoulder, L.dmax);
          d = Math.max(0, Math.min(L.dmax, d));

          // Per-pixel noise, binomial amplitude from crystal count
          const noise = layerNoise[j][i];
          const cs = L.crystalSize ?? 0.3;
          const N = 1 / (cs * cs + 0.01);
          const p = Math.max(0, Math.min(1, d / Math.max(L.dmax, 0.01)));
          const sigma = Math.sqrt(p * (1 - p) / Math.max(N, 0.1));
          const amplitude = L.dyePurity < 0.01 ? 1.2 : 0.7;
          d = Math.max(0, Math.min(L.dmax, d + noise * sigma * L.dmax * amplitude));

          if (stackStr > 0) {
            const [aR, aG, aB] = dyeA(L.dyeHue, L.dyePurity);
            const mix = (base, att) => base * (1 - stackStr) + att * stackStr;
            availR = mix(availR, availR * Math.exp(-aR * d * LN10));
            availG = mix(availG, availG * Math.exp(-aG * d * LN10));
            availB = mix(availB, availB * Math.exp(-aB * d * LN10));
          }
          dens.push(isPos ? L.dmax - d : d);
        }
        const dir = g.dirInhibition;
        const totalDenSum = dens.reduce((a, b) => a + b, 0);
        const d = dens.map(v => Math.max(0, v - dir * (totalDenSum - v) * 0.15));
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
