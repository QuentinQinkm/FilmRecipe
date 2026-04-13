#include <CoreImage/CoreImage.h>
using namespace metal;

// --- Constants ---
constant float3 CH = float3(625.0, 540.0, 450.0);
constant float LN10 = 2.302585;
constant int MAX_LAYERS = 5;

// --- sRGB linearization ---
float s2l(float c) {
    return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}

float l2s(float c) {
    return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(max(c, 0.0), 1.0/2.4) - 0.055;
}

// --- Spectral sensitivity (Gaussian) ---
float sens(float ch, float pk, float bw) {
    float sigma = bw / 2.355;
    float d = (ch - pk) / sigma;
    return exp(-0.5 * d * d);
}

// --- H&D characteristic curve ---
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

// --- Dye absorption vector ---
float3 dyeAbs(float hue, float pur) {
    float ah = fmod(hue + 180.0, 360.0) / 60.0;
    float x = 1.0 - abs(fmod(ah, 2.0) - 1.0);
    float3 c;
    if      (ah < 1.0) c = float3(1.0, x,   0.0);
    else if (ah < 2.0) c = float3(x,   1.0, 0.0);
    else if (ah < 3.0) c = float3(0.0, 1.0, x  );
    else if (ah < 4.0) c = float3(0.0, x,   1.0);
    else if (ah < 5.0) c = float3(x,   0.0, 1.0);
    else               c = float3(1.0, 0.0, x  );
    return c * pur;
}

// --- Grain model ---
float hash2(float2 p) {
    float h = dot(p, float2(127.1, 311.7));
    return fract(sin(h) * 43758.5453);
}

float jitteredHash(float2 pos, float scale, float seed) {
    float2 cell = floor(pos / scale);
    float2 cellId = cell + float2(seed);
    float jx = hash2(cellId * 1.73 + float2(37.8, 92.1));
    float jy = hash2(cellId * 2.31 + float2(64.3, 18.7));
    float2 jittered = cell + float2(jx, jy);
    return hash2(jittered + float2(seed)) * 2.0 - 1.0;
}

float crystalNoise(float2 pos, float cs, float seed) {
    float scale1 = max(1.5, cs * 5.0);
    float scale2 = max(1.0, cs * 2.5);
    float n1 = jitteredHash(pos, scale1, seed);
    float n2 = jitteredHash(pos, scale2, seed + 500.0);
    return n1 * 0.7 + n2 * 0.3;
}

float layerGrain(float2 pos, float cs, float density, float dm, float seed) {
    float noise = crystalNoise(pos, cs, seed);
    float N = 1.0 / (cs * cs + 0.01);
    float p = clamp(density / max(dm, 0.01), 0.0, 1.0);
    float sigma = sqrt(p * (1.0 - p) / max(N, 0.1));
    return noise * sigma * dm * 1.2;
}

// --- Main kernel ---
extern "C" float4 filmSimulation(
    coreimage::sample_t src,
    float4 peaks_bws,
    float4 peaks_bws2,
    float4 peak_bw4,
    float4 toes_gammas,
    float4 toes_gammas2,
    float4 toe_gam4,
    float4 shos_dmaxs,
    float4 shos_dmaxs2,
    float4 sho_dmax4,
    float4 hues_purs,
    float4 hues_purs2,
    float4 hue_pur4,
    float4 crystals,
    float4 crystal4,
    float reversal,
    float raw,
    float layerCount,
    float dir,
    float maskDen,
    float maskHue,
    float3 baseTint,
    float stackStr,
    coreimage::destination dest
) {
    // Unpack layer arrays from float4 vectors
    float sensPeak[5];
    float sensBw[5];
    float hdToe[5];
    float hdGamma[5];
    float hdShoulder[5];
    float dmax[5];
    float dyeHue[5];
    float dyePurity[5];
    float crystal[5];

    sensPeak[0] = peaks_bws.x;  sensBw[0] = peaks_bws.y;
    sensPeak[1] = peaks_bws.z;  sensBw[1] = peaks_bws.w;
    sensPeak[2] = peaks_bws2.x; sensBw[2] = peaks_bws2.y;
    sensPeak[3] = peaks_bws2.z; sensBw[3] = peaks_bws2.w;
    sensPeak[4] = peak_bw4.x;   sensBw[4] = peak_bw4.y;

    hdToe[0] = toes_gammas.x;    hdGamma[0] = toes_gammas.y;
    hdToe[1] = toes_gammas.z;    hdGamma[1] = toes_gammas.w;
    hdToe[2] = toes_gammas2.x;   hdGamma[2] = toes_gammas2.y;
    hdToe[3] = toes_gammas2.z;   hdGamma[3] = toes_gammas2.w;
    hdToe[4] = toe_gam4.x;      hdGamma[4] = toe_gam4.y;

    hdShoulder[0] = shos_dmaxs.x;  dmax[0] = shos_dmaxs.y;
    hdShoulder[1] = shos_dmaxs.z;  dmax[1] = shos_dmaxs.w;
    hdShoulder[2] = shos_dmaxs2.x; dmax[2] = shos_dmaxs2.y;
    hdShoulder[3] = shos_dmaxs2.z; dmax[3] = shos_dmaxs2.w;
    hdShoulder[4] = sho_dmax4.x;   dmax[4] = sho_dmax4.y;

    dyeHue[0] = hues_purs.x;    dyePurity[0] = hues_purs.y;
    dyeHue[1] = hues_purs.z;    dyePurity[1] = hues_purs.w;
    dyeHue[2] = hues_purs2.x;   dyePurity[2] = hues_purs2.y;
    dyeHue[3] = hues_purs2.z;   dyePurity[3] = hues_purs2.w;
    dyeHue[4] = hue_pur4.x;     dyePurity[4] = hue_pur4.y;

    crystal[0] = crystals.x; crystal[1] = crystals.y;
    crystal[2] = crystals.z; crystal[3] = crystals.w;
    crystal[4] = crystal4.x;

    int nLayers = int(layerCount);
    float2 fragCoord = dest.coord();

    // Linearize input
    float3 lin = float3(s2l(src.r), s2l(src.g), s2l(src.b));

    // Detect B&W
    bool isBW = true;
    for (int i = 0; i < 5; i++) {
        if (i >= nLayers) break;
        if (dyePurity[i] >= 0.01) { isBW = false; break; }
    }
    bool isPos = !isBW && reversal > 0.5;
    bool isNeg = !isBW && reversal < 0.5;
    float3 out3;

    float seeds[5] = {0.0, 73.156, 191.329, 347.718, 521.437};

    if (isBW) {
        float3 w = float3(sens(CH.x, sensPeak[0], sensBw[0]),
                          sens(CH.y, sensPeak[0], sensBw[0]),
                          sens(CH.z, sensPeak[0], sensBw[0]));
        float exposure = dot(lin, w) / max(dot(w, float3(1.0)), 0.001);
        float den = hd(exposure, hdToe[0], hdGamma[0], hdShoulder[0], 2.5);
        den = clamp(den + layerGrain(fragCoord, crystal[0], den, 2.5, seeds[0]), 0.0, 2.5);
        float lum = raw > 0.5 ? 1.0 - den / 2.5 : den / 2.5;
        lum = clamp(lum, 0.0, 1.0);
        out3 = float3(lum) * baseTint;
    } else {
        float dn[5];
        float3 avail = lin;

        for (int i = 0; i < 5; i++) {
            if (i >= nLayers) break;
            float3 w = float3(sens(CH.x, sensPeak[i], sensBw[i]),
                              sens(CH.y, sensPeak[i], sensBw[i]),
                              sens(CH.z, sensPeak[i], sensBw[i]));
            float e = dot(avail, w) / max(dot(w, float3(1.0)), 0.001);
            float d = hd(e, hdToe[i], hdGamma[i], hdShoulder[i], dmax[i]);
            d = clamp(d + layerGrain(fragCoord, crystal[i], d, dmax[i], seeds[i]), 0.0, dmax[i]);
            dn[i] = d;

            if (stackStr > 0.0) {
                float3 sa = dyeAbs(dyeHue[i], dyePurity[i]) * d;
                avail *= mix(float3(1.0), exp(-sa * LN10), stackStr);
            }
        }

        if (isPos) {
            for (int i = 0; i < 5; i++) {
                if (i >= nLayers) break;
                dn[i] = dmax[i] - dn[i];
            }
        }

        float totalDenSum = 0.0;
        for (int i = 0; i < 5; i++) {
            if (i >= nLayers) break;
            totalDenSum += dn[i];
        }
        float d2[5];
        for (int i = 0; i < 5; i++) {
            if (i >= nLayers) break;
            float inh = totalDenSum - dn[i];
            d2[i] = max(0.0, dn[i] - dir * inh * 0.15);
        }

        float3 totalOD = float3(0.0);
        for (int i = 0; i < 5; i++) {
            if (i >= nLayers) break;
            float3 da = dyeAbs(dyeHue[i], dyePurity[i]);
            totalOD += da * d2[i];
        }

        if (isNeg && raw < 0.5) {
            float scanExp = 3.0;
            out3 = float3(1.0) - exp(-totalOD * scanExp);
        } else if (isNeg) {
            float mh = clamp(maskHue / 60.0, 0.0, 1.0);
            float3 maskOD = float3(maskDen * mix(0.65, 0.45, mh),
                                   maskDen * mix(0.15, 0.40, mh),
                                   maskDen * mix(0.05, 0.10, mh));
            out3 = exp(-(totalOD + maskOD) * LN10);
        } else {
            out3 = exp(-totalOD * LN10);
        }

        out3 *= baseTint;
    }

    return float4(l2s(out3.r), l2s(out3.g), l2s(out3.b), 1.0);
}
