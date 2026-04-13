const VERT_SRC = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG_SRC = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uImg;
uniform float uReversal; // 0=negative process, 1=reversal (E-6)
uniform float uRaw;
uniform vec3 uSensPeak, uSensBw;
uniform vec3 uToe, uGamma, uShoulder, uDmax;
uniform vec3 uDyeHue, uDyePurity, uCrystal;
uniform float uDir, uMaskDen, uMaskHue;
uniform vec3 uBaseTint;
uniform float uPassthrough;
uniform float uStackStr;

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

float hsh(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float grn(vec2 pos, float sc) {
  return hsh(floor(pos / max(sc, 1.0))) * 2.0 - 1.0;
}
float grnAmt(float lum, float cs) {
  float pk = 1.0 - abs(lum - 0.45) * 2.0;
  return max(0.0, pk) * cs * 0.08;
}

void main() {
  vec4 tx = texture2D(uImg, vUV);
  if (uPassthrough > 0.5) { gl_FragColor = tx; return; }
  vec3 lin = vec3(s2l(tx.r), s2l(tx.g), s2l(tx.b));
  bool isBW  = uDyePurity.x < 0.01 && uDyePurity.y < 0.01 && uDyePurity.z < 0.01;
  bool isPos = !isBW && uReversal > 0.5;
  bool isNeg = !isBW && uReversal < 0.5;
  vec3 out3;

  if (isBW) {
    vec3 w = vec3(sens(CH.x, uSensPeak.x, uSensBw.x),
                  sens(CH.y, uSensPeak.x, uSensBw.x),
                  sens(CH.z, uSensPeak.x, uSensBw.x));
    float exposure = dot(lin, w) / max(dot(w, vec3(1.0)), 0.001);
    float den = hd(exposure, uToe.x, uGamma.x, uShoulder.x, 2.5);
    float lum = uRaw > 0.5 ? 1.0 - den / 2.5 : den / 2.5;
    lum = clamp(lum, 0.0, 1.0);
    float g = grn(gl_FragCoord.xy, max(1.0, uCrystal.x * 4.0));
    lum = clamp(lum + g * grnAmt(lum, uCrystal.x), 0.0, 1.0);
    out3 = vec3(lum) * uBaseTint;
  } else {
    vec3 w0 = vec3(sens(CH.x, uSensPeak.x, uSensBw.x), sens(CH.y, uSensPeak.x, uSensBw.x), sens(CH.z, uSensPeak.x, uSensBw.x));
    vec3 w1 = vec3(sens(CH.x, uSensPeak.y, uSensBw.y), sens(CH.y, uSensPeak.y, uSensBw.y), sens(CH.z, uSensPeak.y, uSensBw.y));
    vec3 w2 = vec3(sens(CH.x, uSensPeak.z, uSensBw.z), sens(CH.y, uSensPeak.z, uSensBw.z), sens(CH.z, uSensPeak.z, uSensBw.z));

    // Layer 0 (topmost): sees original light
    float e0 = dot(lin, w0) / max(dot(w0, vec3(1.0)), 0.001);
    float dn0 = hd(e0, uToe.x, uGamma.x, uShoulder.x, uDmax.x);

    // Stacking attenuation: upper layers filter light for lower ones
    vec3 sa0 = dyeAbs(uDyeHue.x, uDyePurity.x) * dn0;
    vec3 avail1 = lin * mix(vec3(1.0), exp(-sa0 * LN10), uStackStr);

    float e1 = dot(avail1, w1) / max(dot(w1, vec3(1.0)), 0.001);
    float dn1 = hd(e1, uToe.y, uGamma.y, uShoulder.y, uDmax.y);

    vec3 sa1 = dyeAbs(uDyeHue.y, uDyePurity.y) * dn1;
    vec3 avail2 = avail1 * mix(vec3(1.0), exp(-sa1 * LN10), uStackStr);

    float e2 = dot(avail2, w2) / max(dot(w2, vec3(1.0)), 0.001);
    float dn2 = hd(e2, uToe.z, uGamma.z, uShoulder.z, uDmax.z);

    if (isPos) {
      dn0 = uDmax.x - dn0;
      dn1 = uDmax.y - dn1;
      dn2 = uDmax.z - dn2;
    }

    float d0 = max(0.0, dn0 - uDir * (dn1 + dn2) * 0.15);
    float d1 = max(0.0, dn1 - uDir * (dn0 + dn2) * 0.15);
    float d2 = max(0.0, dn2 - uDir * (dn0 + dn1) * 0.15);

    vec3 da0 = dyeAbs(uDyeHue.x, uDyePurity.x);
    vec3 da1 = dyeAbs(uDyeHue.y, uDyePurity.y);
    vec3 da2 = dyeAbs(uDyeHue.z, uDyePurity.z);
    vec3 totalOD = da0 * d0 + da1 * d1 + da2 * d2;
    vec3 trans = exp(-totalOD * LN10);

    if (isNeg && uRaw < 0.5) {
      // Negative scan: map dye density to print brightness
      // Mask cancels out (film has mask+dye, scanner subtracts mask → dye only)
      float scanExp = 3.0;
      out3 = vec3(1.0) - exp(-totalOD * scanExp);
    } else if (isNeg) {
      // Raw negative: physically include orange mask in transmittance
      // maskHue (0-60) shifts mask color: 0=red-orange, 28=classic orange, 60=yellow-orange
      float mh = clamp(uMaskHue / 60.0, 0.0, 1.0);
      vec3 maskOD = vec3(uMaskDen * mix(0.65, 0.45, mh),
                         uMaskDen * mix(0.15, 0.40, mh),
                         uMaskDen * mix(0.05, 0.10, mh));
      out3 = exp(-(totalOD + maskOD) * LN10);
    } else {
      out3 = trans;
    }

    out3 *= uBaseTint;
    float avgC = (uCrystal.x + uCrystal.y + uCrystal.z) / 3.0;
    float lum = dot(out3, vec3(0.333));
    float gv = grn(gl_FragCoord.xy, max(1.0, avgC * 4.0));
    out3 = clamp(out3 + vec3(gv * grnAmt(lum, avgC)), 0.0, 1.0);
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
    this.u = {};
    const names = [
      'uImg','uReversal','uRaw',
      'uSensPeak','uSensBw','uToe','uGamma','uShoulder','uDmax',
      'uDyeHue','uDyePurity','uCrystal',
      'uDir','uMaskDen','uMaskHue','uBaseTint','uPassthrough','uStackStr'
    ];
    for (const n of names) this.u[n] = gl.getUniformLocation(prog, n);
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
    const needCPU = !this.gl || recipe.layers.length > 3;
    if (!needCPU) {
      this._renderGL(recipe, rawMode);
    } else {
      const out = this._renderCPU(recipe, rawMode);
      if (out && this.gl) {
        this._blitViaGL(out);
      } else if (out) {
        const { canvas } = this;
        canvas.width = out.width;
        canvas.height = out.height;
        canvas.getContext('2d').putImageData(out, 0, 0);
      }
    }
  }

  _blitViaGL(imageData) {
    const gl = this.gl;
    const { canvas } = this;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(this.prog);

    const tmp = document.createElement('canvas');
    tmp.width = imageData.width;
    tmp.height = imageData.height;
    tmp.getContext('2d').putImageData(imageData, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tmp);
    gl.uniform1i(this.u.uImg, 0);
    gl.uniform1f(this.u.uPassthrough, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (this._sourceCanvas) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._sourceCanvas);
    }
  }

  _renderGL(recipe, rawMode) {
    const gl = this.gl;
    const { canvas } = this;
    canvas.width = this.imageWidth;
    canvas.height = this.imageHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(this.prog);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.u.uImg, 0);

    const L = recipe.layers;
    const v3 = (key, def) => [L[0]?.[key] ?? def, L[1]?.[key] ?? def, L[2]?.[key] ?? def];

    gl.uniform1f(this.u.uPassthrough, 0);
    gl.uniform1f(this.u.uReversal, recipe.global.reversal || 0);
    gl.uniform1f(this.u.uRaw, rawMode ? 1 : 0);
    gl.uniform3fv(this.u.uSensPeak, v3('sensitizerPeak', 550));
    gl.uniform3fv(this.u.uSensBw, v3('sensitizerBw', 100));
    gl.uniform3fv(this.u.uToe, v3('hdToe', 0.2));
    gl.uniform3fv(this.u.uGamma, v3('hdGamma', 0.7));
    gl.uniform3fv(this.u.uShoulder, v3('hdShoulder', 0.15));
    gl.uniform3fv(this.u.uDmax, v3('dmax', 2.0));
    gl.uniform3fv(this.u.uDyeHue, v3('dyeHue', 0));
    gl.uniform3fv(this.u.uDyePurity, v3('dyePurity', 0));
    gl.uniform3fv(this.u.uCrystal, v3('crystalSize', 0.3));

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
        const den = hdC(exp, L.hdToe, L.hdGamma, L.hdShoulder, 2.5);
        let lum = rawMode ? 1 - den / 2.5 : den / 2.5;
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
          const d = hdC(exp, L.hdToe, L.hdGamma, L.hdShoulder, L.dmax);
          // Stacking uses pre-reversal density (matches GPU path)
          if (stackStr > 0) {
            const [aR, aG, aB] = dyeA(L.dyeHue, L.dyePurity);
            const mix = (base, att) => base * (1 - stackStr) + att * stackStr;
            availR = mix(availR, availR * Math.exp(-aR * d * LN10));
            availG = mix(availG, availG * Math.exp(-aG * d * LN10));
            availB = mix(availB, availB * Math.exp(-aB * d * LN10));
          }
          // Apply reversal after stacking attenuation
          dens.push(isPos ? L.dmax - d : d);
        }
        const dir = g.dirInhibition;
        const d = dens.map((v, j) => {
          let inh = 0;
          for (let k = 0; k < dens.length; k++) if (k !== j) inh += dens[k];
          return Math.max(0, v - dir * inh * 0.15);
        });
        let totR = 0, totG = 0, totB = 0;
        for (let j = 0; j < layers.length; j++) {
          const [aR, aG, aB] = dyeA(layers[j].dyeHue, layers[j].dyePurity);
          totR += aR * d[j]; totG += aG * d[j]; totB += aB * d[j];
        }
        const tR = Math.exp(-totR * LN10);
        const tG = Math.exp(-totG * LN10);
        const tB = Math.exp(-totB * LN10);

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
          oR = tR; oG = tG; oB = tB;
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
